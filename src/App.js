import axios from 'axios';
import { createRenderer } from 'react-dom/test-utils';
import './App.css';
// import request from '../utils/request';
import Visualize from "./Visualize";



function App() {
  return (
    <div className="App">
      <Visualize />
    </div>
  );
}

export default App;
