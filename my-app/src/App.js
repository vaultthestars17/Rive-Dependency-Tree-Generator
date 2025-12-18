import logo from './logo.svg';
import './App.css';

import ReactDOM from 'react-dom';
import './index.css';

import React, { useEffect, useState } from 'react';
import xmlJs from 'xml-js';

//WHAT DO WE WANT TO DO HERE?
//RECURSIVELY TRAVERSE THRU THE ENTIRE TREE STRUCTURE
//CREATE A NODE AND EDGE FOR EACH ELEMENT WE ENCOUNTER ON THE WAY DOWN


function recursenode(node){
//  console.log(node._attributes.name)
 if(Object.keys(node).length > 0){
  for(const childkey in node){
    console.log(childkey)
    recursenode(node[childkey])
  }
 }
}

function printAllVals(obj) {
  for (let k in obj) {
    if (typeof obj[k] === "object") {
      printAllVals(obj[k]);
    } else {
      // base case, stop recurring
      console.log(obj[k]);
    }
  }
}

function App() {
  const [xmlData, setXmlData] = useState(null);
  
  useEffect(() => {
    fetch('avatar_vis_dev_009.xml') // Replace with the URL or path to your XML data
      .then((response) => response.text())
      .then((xmlText) => {
        const jsonData = xmlJs.xml2json(xmlText, { compact: true, spaces: 4 });
        // JSON.parse(jsonData, function (key, value){
        //   if(key == "name"){
        //     console.log(value)
        //   }
        // });

        

        const thedata = JSON.parse(jsonData);

        const artboards = thedata.everything.Artboard
        printAllVals(artboards)
        // for(const key in artboards){
        //   // console.log(artboards[key]._attributes.name + ", id: " + artboards[key]._attributes.id)
        //   // for(const childkey in artboards[key]){
        //   //   console.log(artboards[key][childkey])
        //   // }
        //   recursenode(artboards[key])
        // }
        // recursenode(thedata.everything.Artboard)

        setXmlData(thedata);
        
      })
      .catch((error) => {
        console.error('Error fetching XML data:', error);
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>

      <div className="container">  
          {xmlData ? (
            <pre>{
              JSON.stringify(xmlData, null, 4)
              }</pre>
          ) : (
            <p>Loading XML data...</p>
          )}
        </div>
    </div>
  );
}

export default App;
