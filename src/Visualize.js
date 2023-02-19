import {Component} from "react";
import * as THREE from "three";
import { Mesh, MeshStandardMaterial } from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {PointerLockControls} from "three/examples/jsm/controls/PointerLockControls";
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader";
// import {JSONLoader} from "three/examples/jsm/loaders/JSONLoader";
// import {ObjectLoader} from "three/examples/jsm/loaders/ObjectLoader";
import "./Visualize.css";
import axios from "axios";
import { type } from "@testing-library/user-event/dist/type";
// import ApiUtil from "./utils/ApiUtil";
// import HttpUtil from "./utils/HttpUtil";
import {saveAs} from 'file-saver';

class Visualize extends Component {

    constructor(props){
        super(props);
        this.state = {
            positionx:45,
            positiony:48.6,
            positionz:90,
            Id:0,
            // tttt:'1'
        
        }
    }
    componentDidMount() {
        this.cvsWidth = window.innerWidth / 2;
        this.cvsHeight = window.innerHeight;

        this.simuRenderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
        this.simuRenderer.setSize(this.cvsWidth, this.cvsHeight);
        this.twinRenderer = new THREE.WebGLRenderer({antialias: true});
        this.twinRenderer.setSize(this.cvsWidth, this.cvsHeight);

        this.simuContainer = document.getElementById("simuContainer");
        this.simuContainer.appendChild(this.simuRenderer.domElement);
        this.twinContainer = document.getElementById("twinContainer");
        this.twinContainer.appendChild(this.twinRenderer.domElement);

        this.simuScene = new THREE.Scene();
        this.simuScene.background = new THREE.Color(0xdcdcdc);
        this.twinScene = new THREE.Scene();
        this.twinScene.background = new THREE.Color(0xdcdcdc);

        this.simuCamera = new THREE.PerspectiveCamera(50, this.cvsWidth / this.cvsHeight);
        this.simuCameraControls = new OrbitControls(this.simuCamera, this.simuRenderer.domElement);
        this.twinCamera = new THREE.PerspectiveCamera(50, this.cvsWidth / this.cvsHeight);
        this.twinCameraControls = new OrbitControls(this.twinCamera, this.twinRenderer.domElement);

        this.robotCamera = new THREE.PerspectiveCamera(50, 1920 / 1080,0.1, 1000);
        this.robotCameraControls = new PointerLockControls(this.robotCamera, this.simuRenderer.domElement);
        this.robotCameraHelper = new THREE.CameraHelper(this.robotCamera);

        this.raycaster = new THREE.Raycaster();

        this.initTexture();

        // this.initSimuScene()

        // this.initTwinScene();

        this.bindEvents();
        this.animate();
        this.center = new Array();
        this.area_number = 0;
    }

    renderThree() {
        // console.log("renderThree()")
        this.robotCameraHelper.visible = true;
        this.simuRenderer.setViewport(0, 0, this.cvsWidth, this.cvsHeight);
        this.simuRenderer.setScissor(0, 0, this.cvsWidth, this.cvsHeight);
        this.simuRenderer.render(this.simuScene, this.simuCamera);

        this.robotCameraHelper.visible = false;
        this.simuRenderer.setViewport(0, 0, 384, 216);
        this.simuRenderer.setScissor(0, 0, 384, 216);
        this.simuRenderer.render(this.simuScene, this.robotCamera);

        this.twinRenderer.render(this.twinScene, this.twinCamera);
    }

    animate() {
        console.log("animate()")
        const animateProxy = () => {
            requestAnimationFrame(animateProxy);

            this.simuCameraControls.update();
            this.twinCameraControls.update();

            if (this.robotCameraControls.isLocked) {
                this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
                this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
                this.direction.y = Number(this.moveUp) - Number(this.moveDown);
                this.direction.normalize();
                this.robotCameraControls.moveRight(this.direction.x);
                this.robotCameraControls.moveForward(this.direction.z);
                this.robotCameraControls.getObject().position.y += this.direction.y;
            }

            this.renderThree();
        }
        animateProxy();
    }

    onWindowResize() {
        console.log("onWindowResize()")
        this.cvsWidth = window.innerWidth / 2;
        this.cvsHeight = window.innerHeight;

        this.simuRenderer.setSize(this.cvsWidth, this.cvsHeight);
        this.twinRenderer.setSize(this.cvsWidth, this.cvsHeight);

        this.simuCamera.aspect = this.cvsWidth / this.cvsHeight;
        this.simuCamera.updateProjectionMatrix();
        this.twinCamera.aspect = this.cvsWidth / this.cvsHeight;
        this.twinCamera.updateProjectionMatrix();

        this.renderThree();
    }

    capture() {
        // this.handleOK();
        console.log("capture(count)")
        const point = this.robotCameraHelper.geometry.getAttribute("position").clone(); // 相机视野范围内所有点的相对位置
        point.applyMatrix4(this.robotCameraHelper.matrix); // 相对位置转变为世界坐标系位置
        const quadUV = [];
        const dist = []
        for (let i = 0; i < 4; i++) {
            const ori = new THREE.Vector3(point.getX(this.nearMap[i]),
                                          point.getY(this.nearMap[i]),
                                          point.getZ(this.nearMap[i])); // 得到相机位置
            const dir = new THREE.Vector3(point.getX(this.farMap[i]),
                                          point.getY(this.farMap[i]),
                                          point.getZ(this.farMap[i])).sub(ori).normalize(); // 得到方向向量
            this.raycaster.set(ori, dir);
            const inter = this.raycaster.intersectObject(this.simuObject); // 射线求交点获取uv坐标
            
            // console.log(inter[0]["uv"])
            if (inter.length > 0) {
                quadUV.push(inter[0]["uv"]);
                dist.push(inter[0]["point"].y)
                // console.log(inter[0].point)
                // console.log(inter[0].distance)
            }
        }

        // const ori_camera = this.robotCamera.position
        this.raycaster.set(new THREE.Vector3(0, -80, 80), new THREE.Vector3(0, 1, 0));
        const inter12 = this.raycaster.intersectObject(this.simuObject)
        // console.log(inter12[0].distance)
        // console.log(inter12[0])
        
        // 相机的lookat
        const lookat = new THREE.Vector3()
        this.robotCamera.getWorldDirection(lookat).normalize()

        //选取相机与模型的交点a
        const ori_camera = this.robotCamera.position
        this.raycaster.set(ori_camera, lookat);
        const inter1 = this.raycaster.intersectObject(this.simuObject)
        // console.log(inter1[0].distance)
        let v_center = JSON.parse(JSON.stringify(inter1[0].point))
        // console.log(v_center)

        //交点a水平向右平移一段距离
        inter1[0].point.z = inter1[0].point.z - 5
        const v_right = JSON.parse(JSON.stringify(inter1[0].point))
        // console.log(v_right)

        //交点a向下平移一段距离
        inter1[0].point.z = inter1[0].point.z + 5
        inter1[0].point.y = inter1[0].point.y - 5
        // const lookat_down = new THREE.Vector3()
        // lookat_down.subVectors(inter1[0].point, ori_camera).normalize()
        this.raycaster.set(new THREE.Vector3(inter1[0].point.x + 10, inter1[0].point.y, inter1[0].point.z), new THREE.Vector3(-1, 0, 0));
        const inter3 = this.raycaster.intersectObject(this.simuObject)
        // console.log(inter3)
        const v_down = JSON.parse(JSON.stringify(inter3[0].point))
        // console.log(v_down)
        const high = Math.sqrt(25 + Math.pow(v_down.x - v_center.x, 2))
        const scale = high / 5
        // console.log(scale)
        
        //推算出矩形右下角模型的三维坐标
        inter3[0].point.z -= 5
        const v_right_down = JSON.parse(JSON.stringify(inter3[0].point))
        // console.log(v_right_down)
        

        //相机的宽、高、焦距
        const w = this.robotCamera.filmGauge
        const h = w / (this.robotCamera.aspect)
        var camera_focal_length = this.robotCamera.getFocalLength ()

        const All_point = this.robotCameraHelper.geometry.getAttribute("position").clone(); // 相机视野范围内所有点的相对位置
        All_point.applyMatrix4(this.robotCameraHelper.matrix); // 相对位置转变为世界坐标系位置
        var shen = new THREE.Vector3(All_point.getX(this.farMap[1]) - All_point.getX(this.farMap[0]),
                                       All_point.getY(this.farMap[1]) - All_point.getY(this.farMap[0]),
                                       All_point.getZ(this.farMap[1]) - All_point.getZ(this.farMap[0])).normalize()
        var ray = new THREE.Ray(ori_camera, lookat)
        function myFunction(v_point){
            // 求夹角
            const target = new THREE.Vector3()
            const v_point_direction = new THREE.Vector3()
            const v_point_pedal = ray.closestPointToPoint(v_point,target) // 垂足
            v_point_direction.subVectors(v_point, v_point_pedal).normalize() // 点到lookat的方向向量
            const angle = v_point_direction.angleTo(shen)
            // console.log(angle)
    
            // 求长度
            const H = v_point_pedal.distanceTo(ori_camera)
            const dis_v_point = ray.distanceToPoint(v_point)
            const length = camera_focal_length / H * dis_v_point
            const x_pixel = Math.cos(angle) * length / w * 384
            const y_pixel = Math.sin(angle) * length / h * 216
            const a = length / w * 384
            const b = length / h * 216
            // console.log(x_pixel, y_pixel)
            return{
                x_pixel: x_pixel, 
                y_pixel:y_pixel,
                a:a,
                b:b
            }
        }
        const point_right = myFunction(v_right)
        const point_down = myFunction(v_down)
        const point_rightdown = myFunction(v_right_down)
        
        
        let s = ''

        if (quadUV.length < 4) {
            alert("Incomplete camera constraints have only " + quadUV.length + " intersections.");
            return;
        }

        const imageData = this.simuRenderer.domElement.toDataURL();
        const image = imageData.split('base64,')[1];
        
        // const final_image = imageData.split('base64,')[0];
        // console.log(final_image)

        // axios.get('http://10.5.24.74:3000/user/alluser')
        // .then(function (response) {
        //     // 处理成功情况
        //     console.log(response);
        // })
        // .catch(function (error) {
        //     // 处理错误情况
        //     console.log(error);
        // })
        // .then(function () {
        //     // 总是会执行
        // });

        const position = this.robotCamera.position


        const {value} = this.selectNumber
        const Id_value = {value}
        console.log(Id_value)
        axios.post("http://127.0.0.1:5000/tran", {image,v_down, point_right, point_down, point_rightdown, lookat, scale, position, Id_value}
        ).then(response=>{
            console.log(response.data)
            if(response.data=='1'){
                alert("贴图已完成，请选择下一任务。");
                return;
            }
            s = response.data['photo']
            const wwww = response.data['pos'].split(" ")

            const Xs = [];
            const Ys = [];
            for (let i = 0; i < 4; i++) {
                Xs.push(quadUV[i].x);
                Ys.push(1 - quadUV[i].y);
            }

            this.robotCamera.position.set(parseFloat(wwww[0]), parseFloat(wwww[1]), parseFloat(wwww[2]))

            this.setState({
                positionx:this.robotCamera.position.x,
                positiony:this.robotCamera.position.y,
                positionz:this.robotCamera.position.z
            })
            
            this.image = new Image();
            this.image.src = s;       
            this.image.onload = () => {
                this.textureContext.drawImage(this.image,
                    this.textureCanvas.width * Math.min.apply(0, Xs), // 贴图的左上角u坐标
                    this.textureCanvas.height * Math.min.apply(0, Ys), // 贴图的左上角v坐标
                    this.textureCanvas.width * (Math.max.apply(0, Xs) - Math.min.apply(0, Xs)),
                    this.textureCanvas.height * (Math.max.apply(0, Ys) - Math.min.apply(0, Ys)));
                // console.log(this.textureCanvas.toDataURL)
                // console.log(Math.min.apply(0, Xs))
                // console.log(Xs)
                // console.log(Ys)

                this.twinObject.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material.map = new THREE.TextureLoader().load(this.textureCanvas.toDataURL());
                        child.material.needsUpdate = true;
                    }
                })
            }    
        })


        const image1 = this.textureCanvas.toDataURL().split('base64,')[1];
        axios.post('http://127.0.0.1:5000/get', {image1})
        .then(function (response) {
            // 处理成功情况
            // console.log(response);
        })
        .catch(function (error) {
            // 处理错误情况ldalaaddadad 
            console.log(error);
        })
        .then(function () {
            // 总是会执行
        });  
    }


    
    onKeyPress(event) {
        console.log("onKeyPress(event, count)")
        switch (event.code) {
            case "KeyL":
                if (this.robotCameraControls.isLocked === false) {
                    this.robotCameraControls.lock();
                }
                break;

            case "Space":
                this.capture();
                break;
        }
    }
    

    onKeyDown(event) {
        console.log("onKeyDown(event)")
        switch (event.code) {
            case "KeyW":
                this.moveForward = true;
                break;
            case "KeyS":
                this.moveBackward = true;
                break;
            case "KeyA":
                this.moveLeft = true;
                break;
            case "KeyD":
                this.moveRight = true;
                break;
            case "KeyR":
                this.moveUp = true;
                break;
            case "KeyF":
                this.moveDown = true;
                break;
        }
    }

    onKeyUp(event) {
        console.log("onKeyUp(event)")
        switch (event.code) {
            case "KeyW":
                this.moveForward = false;
                break;
            case "KeyS":
                this.moveBackward = false;
                break;
            case "KeyA":
                this.moveLeft = false;
                break;
            case "KeyD":
                this.moveRight = false;
                break;
            case "KeyR":
                this.moveUp = false;
                break;
            case "KeyF":
                this.moveDown = false;
                break;
        }
    }

    distance(x,y,z){

        //定义照片中心点和路径类,当鼠标点击飞机表面时定位照片路径功能可以用到
        // var center_path = {
        //     c_x : 0,
        //     c_y : 0,
        //     c_z : 0,
        //     photo_path:"",

        //     create_center_path : function(x,y,z,photop){
        //         this.c_x = x;
        //         this.c_y = y;
        //         this.c_z = z;
        //         this.photo_path = photop;
        //     }

        // };

        // var area_num = points_info.area_num;
        // var centers = new Array(area_num);
        // var n1 = 0;

        
        // for(var item in center_info){
        //     //console.log(center_info[item].area_path);
        //     centers[n1] = Object.create(center_path);
        //     centers[n1].create_center_path(center_info[item]["photo_center_point"].c_x,
        //                                     center_info[item]["photo_center_point"].c_y,
        //                                     center_info[item]["photo_center_point"].c_z,
        //                                     center_info[item].area_path);
        //     n1++;
        // }
        //console.log("测试路径");
        //console.log(centers);
        //开始执行distance
        console.log("start running distance()");
        const centers = this.center;
        const area_num = this.area_number;
        console.log("test centers");
        console.log(centers);
        console.log("test centers pass");
        var dis_min = 0;
        var dis_min_index = 0;
        dis_min = Math.pow(x-centers[0].c_x,2)+Math.pow(y-centers[0].c_y,2)+Math.pow(z-centers[0].c_z,2);
        for(var i=0;i<area_num;i++){
            var dis = Math.pow(x-centers[i].c_x,2)+Math.pow(y-centers[i].c_y,2)+Math.pow(z-centers[i].c_z,2);
            if(dis<dis_min){
                dis_min=dis;
                dis_min_index = i;
            }
        }
        console.log("点击位置对应的照片路径为："+centers[dis_min_index].photo_path);

    }

    click(event){
        //console.log("clicked")
        const scene = this.twinScene;
        // console.log("点击x");
        // console.log(event.clientX);
        // console.log("点击y");
        // console.log(event.clientY);
        if (event.clientX >= 682){
            var vector = new THREE.Vector3(((event.clientX-682) / (window.innerWidth/2)) * 2 - 1, -(event.clientY / window
        .innerHeight) * 2 + 1, 0.5);
        // 将屏幕的坐标转换成三维场景中的坐标
        //this.twinCamera
        vector.unproject(this.twinCamera);
        // console.log("鼠标点击的位置是：");
        // console.log(vector);
        var po = vector.sub(this.twinCamera.position);
        var raycaster = new THREE.Raycaster(this.twinCamera.position, po.normalize());
        var intersects = raycaster.intersectObjects([this.twinObject], true);
        if (intersects.length > 0){
                console.log("点击到了右边的飞机上");
                console.log("坐标为：("+intersects[0].point.x+","+intersects[0].point.y+","+intersects[0].point.z+")");
                // var ball_x = intersects[0].point.x;
                // var ball_y = intersects[0].point.y;
                // var ball_z = intersects[0].point.z;
                // var ball = new THREE.SphereGeometry(0.5,20,20);
                // var ball_material = new THREE.MeshBasicMaterial({color:0xff00ff});
                // var m_ball = new THREE.Mesh(ball,ball_material);
                // m_ball.position.set(ball_x,ball_y,ball_z);
                // scene.add(m_ball);
                console.log(parseInt(intersects[0].point.x));
                //获取到了飞机上的点之后，需要找出对应的照片路径：将该点的坐标和照片中心点的坐标一一比较，找出距离最小的照片路径
                this.distance(parseInt(intersects[0].point.x),
                            parseInt(intersects[0].point.y),
                            parseInt(intersects[0].point.z));
            }
            else{
                console.log("没有点击到飞机上！");
            }
        }
        // var vector = new THREE.Vector3(((event.clientX-682) / (window.innerWidth)) * 2 - 1, -(event.clientY / window
        // .innerHeight) * 2 + 1, 0.5);
        // // 将屏幕的坐标转换成三维场景中的坐标
        // //this.twinCamera
        // vector.unproject(this.twinCamera);
        // console.log("鼠标点击的位置是：");
        // console.log(vector);
        // var po = vector.sub(this.twinCamera.position);
        // var raycaster = new THREE.Raycaster(this.twinCamera.position, po.normalize());
        // var intersects = raycaster.intersectObjects([this.twinObject], true);
        // if (intersects.length > 0){
        //     console.log("点击到了右边的飞机上");
        //     var ball_x = intersects[0].point.x;
        //     var ball_y = intersects[0].point.y;
        //     var ball_z = intersects[0].point.z;
        //     var ball = new THREE.SphereGeometry(0.5,20,20);
        //     var ball_material = new THREE.MeshBasicMaterial({color:0xff00ff});
        //     var m_ball = new THREE.Mesh(ball,ball_material);
        //     m_ball.position.set(ball_x,ball_y,ball_z);
        //     scene.add(m_ball);
        //     console.log(parseInt(intersects[0].point.x));
        //     //获取到了飞机上的点之后，需要找出对应的照片路径：将该点的坐标和照片中心点的坐标一一比较，找出距离最小的照片路径
        //     this.distance(parseInt(intersects[0].point.x),
        //                 parseInt(intersects[0].point.y),
        //                 parseInt(intersects[0].point.z));
        // }
        // else{
        //     console.log("没有点击到飞机上！");
        // }
    }

    bindEvents() {
        console.log("bindEvents()")
        window.addEventListener("resize", () => {this.onWindowResize();});
        document.addEventListener("keypress", (event) => {this.onKeyPress(event);});
        document.addEventListener("keydown", (event) => {this.onKeyDown(event);});
        document.addEventListener("keyup", (event) => {this.onKeyUp(event);});
        document.addEventListener("click", (event) => {this.click(event);});
    }

    initTexture() {
        console.log("initTexture()")
        this.textureCanvas = document.createElement("canvas");
        this.textureCanvas.width = 1000;
        this.textureCanvas.height = 1000;
        this.textureContext = this.textureCanvas.getContext("2d");
        this.textureContext.fillStyle="white"; //设置填充色
        this.textureContext.fillRect(0,0,1000,1000); //创建一个矩形，并填充颜色
        // const container = document.getElementById("cvs");
        // container.appendChild(this.textureCanvas);
    }

    initSimuScene(modelpara) {
        console.log("initSimuScene()")
        this.simuRenderer.setScissorTest(true);

        this.simuCamera.position.set(450, 450, 450);

        this.robotCamera.position.set(45, 48.6, 90)

        this.robotCamera.lookAt(0, 56.5, 80)
        this.robotCamera.lookAt(0, 48.5, 90)

        
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;
        this.direction = new THREE.Vector3();

        const scene = this.simuScene;

        this.nearMap = [];
        this.farMap = [];
        for (let i = 1; i < 5; i++) {
            this.nearMap.push(this.robotCameraHelper.pointMap["n" + i][0]);
            this.farMap.push(this.robotCameraHelper.pointMap["f" + i][0]);
        }
        scene.add(this.robotCameraHelper);

        const grid = new THREE.GridHelper(2000, 50);
        grid.material.transparent = true;
        grid.material.opacity = 0.2;
        scene.add(grid);

        const light = new THREE.DirectionalLight();
        light.position.set(100, 100, -10);
        scene.add(light);

        
        // const geo = new THREE.BoxGeometry(200, 0.2, 0.2)
        // const met = new MeshStandardMaterial()
        // var mesh1 = new THREE.Mesh(geo, met)
        // mesh1.position.set(0, 77, 90)
        // scene.add(mesh1)
        // var mesh2 = new THREE.Mesh(geo, met)
        // mesh2.position.set(0, 20, 90)
        // scene.add(mesh2)
        // var mesh3 = new THREE.Mesh(geo, met)
        // mesh3.position.set(27.802048627242446, 45.117039704094026, 93.4190876801781)
        // scene.add(mesh3)
        // var mesh4 = new THREE.Mesh(geo, met)
        // mesh4.position.set(27.802048627242446, 45.117039704094026, 88.4190876801781)
        // scene.add(mesh4)

        // const geo1 = new THREE.BoxGeometry(2, 2, 2)
        // var mesh5 = new THREE.Mesh(geo1, met)
        // mesh5.position.set(27.69132017748168, 50.96173596450367, 86.92283004437043)
        // // scene.add(mesh5)

        console.log(modelpara)
        const loader = new THREE.ObjectLoader();
        loader.parse(
            modelpara,
            (object) => {
                object.position.set(0, 71, 0);
                object.rotation.z = Math.PI
                object.rotation.y = Math.PI
                scene.add(object);
                this.simuObject = object;
            }
        );
    }

    initTwinScene(h_photo) {
        console.log("initTwinScene()")
        this.twinCamera.position.set(450, 450, 450);

        const scene = this.twinScene;

        const grid = new THREE.GridHelper(2000, 50);
        grid.material.transparent = true;
        grid.material.opacity = 0.2;
        scene.add(grid);

        const light = new THREE.AmbientLight();
        light.intensity = 0.9;
        scene.add(light);

        var axes = new THREE.AxesHelper(100);
        scene.add(axes);
        
        const geo1 = new THREE.BoxGeometry(2, 2, 2)
        const material_1 = new THREE.MeshLambertMaterial
        var mesh_1 = new THREE.Mesh(geo1, material_1)
        mesh_1.position.set(-180, 150, 90)
        scene.add(mesh_1)
        console.log(mesh_1.toJSON())  //object
        
        // const loader = new OBJLoader();
        const loader = new THREE.ObjectLoader();
        loader.load(
            "old/boeing1.json",
            (object) => {
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if(h_photo !=''){
                            this.image_photo = new Image()
                            this.image_photo.src = h_photo 
                            child.material.map = new THREE.TextureLoader().load(this.image_photo.src);
                            child.material.transparent=true;
                            // child.material.opacity=0.8
                        }
                        
                    }
                });
                object.position.set(0, 71, 0);
                scene.add(object);
                this.twinObject = object;
                object.opacity = 0.8
                object.rotation.z = Math.PI
                object.rotation.y = Math.PI
            }
        );
    }

    //显示损伤点的函数
    show_damage(points_info){
        //console.log("hhhhhshowdamagehhh")
        //console.log(points_info);
        const scene = this.twinScene;
         //定义光线类，需要有光心坐标、成像平面上的坐标等，后续可能要添加一下需要显示的文件路径
        var line = {
            camera_x : 0,
            camera_y : 0,
            camera_z : 0,
            photo_point_x : 0,
            photo_point_y : 0,
            photo_point_z : 0,
            photo_path:"",
        
            create_line : function(cx,cy,cz,px,py,pz,photo_r){
                this.camera_x = cx;
                this.camera_y = cy;
                this.camera_z = cz;
                this.photo_point_x = px;
                this.photo_point_y = py;
                this.photo_point_z = pz;
                this.photo_path = photo_r;
            }
        };


        //设定区域数量
        var area_num = points_info.area_num;
        var sq_area = new Array(area_num);
        var s_n = 0;//sq_area和sq_paths的索引
        //var ball_nses = new Array(area_num);
        var sq_paths = new Array(area_num);
        var sq_path = '';


        //定义一个光线数组，里面存着所有的光线对象，后面从数组中读取每个对象并进行显示即可
        var lines_num = points_info.lines_num;
        var n = 0;
        var lines = new Array(lines_num);
        //console.log(points_info);
        //逐个实例化光线对象
        for (var key in points_info){
            //console.log(key);
            if(key=="lines_num"||key=="area_num"){
                continue;
            }
            lines[n] = Object.create(line);
            lines[n].create_line(points_info[key].camera_x,points_info[key].camera_y,points_info[key].camera_z,
                points_info[key].photo_point_x,points_info[key].photo_point_y,points_info[key].photo_point_z,
                points_info[key].photo_path);
            n++;
            if(n==lines_num) break;
        } 

        //定义运算变量
         var x_total = 0;
         var y_total = 0;
         var z_total = 0;
         var single_area_num = 0;
         var current_photo_path = '';
         var next_photo_path = '';
       // var x_cen = 0, y_cen = 0,z_cen = 0;
       // var rad = 0;


       //console.log("show_points");
       //使用上面定义好的lines数组，从中取出每个对象并且显示
       for(var i=0;i<lines_num;i++){
           var camera_center = new THREE.Vector3(lines[i].camera_x,lines[i].camera_y,lines[i].camera_z);
           var another_point = new THREE.Vector3(lines[i].photo_point_x,lines[i].photo_point_y,lines[i].photo_point_z);
           another_point.sub(camera_center);
           var raycaster_c = new THREE.Raycaster(camera_center, another_point.normalize());
           var intersects_c = raycaster_c.intersectObjects([this.twinObject], true);
           if (intersects_c.length > 0) {
               //将点显示出来
               var ball_x = intersects_c[0].point.x;
               var ball_y = intersects_c[0].point.y;
               var ball_z = intersects_c[0].point.z;
               var ball = new THREE.SphereGeometry(0.5,20,20);
               var ball_material = new THREE.MeshBasicMaterial({color:0x0000ff});
               var m_ball = new THREE.Mesh(ball,ball_material);
               m_ball.position.set(ball_x,ball_y,ball_z);
               scene.add(m_ball);
               //--------------------------------------------------------
               x_total = x_total + ball_x;
               y_total = y_total + ball_y;
               z_total = z_total + ball_z;
               single_area_num = single_area_num + 1;
               current_photo_path = lines[i].photo_path;
               if(i==(lines_num-1)){
                   //表示没有i+1,保存完最后一个区域就退出
                   //console.log('last');
                   //save_area();
                   console.log(sq_paths);
                   break;
               }

               next_photo_path = lines[i+1].photo_path;

               if(current_photo_path!=next_photo_path){
                   //save_area();
               }

           }
           if(intersects_c.length == 0){
               console.log("没有获取到坐标")
           }

       }

    }

    mymodel(){
        const {value} = this.selectModel
        const model_value = {value}
        console.log(model_value)
        
        const that = this
        async function init(){



            //gjj添加的点击按钮显示损伤点的代码
            if (model_value.value == '4'){
                //点击按钮之后，将show_damage字段返回到对应的路径函数
                var res = await axios.post('http://127.0.0.1:5000/damage', {model_value})
                .then(response => data = response.data)
                //res 应为从后端返回的处理好的损伤点的json字符串
                //接下来需要执行一个函数，该函数接收res字段并在飞机上显示出来损伤点
                that.show_damage(res)

                //拿到中心点json数据center_info
                var center_info = await axios.post('http://127.0.0.1:5000/center', {model_value})
                .then(response => data = response.data)
                //console.log(center_info)
                //this.center_information = center_info;
                //拿到数据库中的数据直接处理
                //定义照片中心点和路径类,当鼠标点击飞机表面时定位照片路径功能可以用到
                var center_path = {
                    c_x : 0,
                    c_y : 0,
                    c_z : 0,
                    photo_path:"",

                    create_center_path : function(x,y,z,photop){
                        this.c_x = x;
                        this.c_y = y;
                        this.c_z = z;
                        this.photo_path = photop;
                    }  

                };

                var area_num = center_info.area_num;
                var centers = new Array(area_num);
                var n1 = 0;
                that.area_number = area_num;

        
                for(var item in center_info){
                    //console.log(center_info[item].area_path);
                    if(item == "area_num"){
                        continue;
                    }
                    centers[n1] = Object.create(center_path);
                    centers[n1].create_center_path(center_info[item]["photo_center_point"].c_x,
                                                    center_info[item]["photo_center_point"].c_y,
                                                    center_info[item]["photo_center_point"].c_z,
                                                    center_info[item].area_path);
                    n1++;
                }
                //console.log("测试路径");
                //console.log(centers);
                //centers是一个数组，后面需要用到，现在需要让centers全局化
                that.center = centers;
                console.log("that center:")
                console.log(that.center);
            }
            else{
                var data = {}
                var res = await axios.post('http://127.0.0.1:5000/model', {model_value})
                .then(response => data = response.data)
             
                that.simuScene.remove(that.simuScene.children[0], that.simuScene.children[1], that.simuScene.children[2], that.simuScene.children[3])
                console.log(typeof(res['cs'])) //object          
                that.initSimuScene(res['cs'])
    
                const h_photo1 = res['h_photo']
                that.twinScene.remove(that.twinScene.children[0], that.twinScene.children[1], that.twinScene.children[2], that.twinScene.children[3])
                that.initTexture() // 切换模型之后重新初始化uv图像
                that.initTwinScene(h_photo1)  // 判断h_photo1是否为空，不为空就代表该模型有对应的拼接图像，直接进行贴图
            }


            
        } 
        init()
    }


    render() {
        return(<div>
            <div id="cvs"></div>
            <div>
                <div id="simuContainer">
                    <div id="camera_pos">Camera_position:（{this.state.positionx.toFixed(2)}, 
                                                           {this.state.positiony.toFixed(2)}, 
                                                           {this.state.positionz.toFixed(2)}）</div>
                </div>
                <div id="twinContainer">
                <div id="taskId" >
                        <select name = "modelid" ref={c => this.selectModel = c} multiple="multiple">
                            <option value="0" onClick={() => {this.mymodel()}}>选择飞机模型</option>
                            <option value="1" onClick={() => {this.mymodel()}}>波音737-200</option>
                            <option value="2" onClick={() => {this.mymodel()}}>波音737-300</option>
                            <option value="3" onClick={() => {this.mymodel()}}>空客A320</option>
                            <option value="4" onClick={() => {this.mymodel()}}>show_damage</option>
                        </select>

                        <select name = 'imageid' ref={c => this.selectNumber = c}>
                            <option value="0">选择图像任务</option>
                            <option value="1">任务一</option>
                            <option value="2">任务二</option>
                            <option value="3">任务三</option>
                            <option value="4">任务四</option>
                        </select>
                    </div>
                </div>
            </div></div>
        );
    }
}


export default Visualize;
