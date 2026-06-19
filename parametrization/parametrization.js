/*
 * Copyright (c) 2026 Sing Chun LEE @ Bucknell University. CC BY-NC 4.0.
 * 
 * This code is provided mainly for educational purposes at University of the Pacific.
 *
 * This code is licensed under the Creative Commons Attribution-NonCommercial 4.0
 * International License. To view a copy of the license, visit 
 *   https://creativecommons.org/licenses/by-nc/4.0/
 * or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
 *
 * You are free to:
 *  - Share: copy and redistribute the material in any medium or format.
 *  - Adapt: remix, transform, and build upon the material.
 *
 * Under the following terms:
 *  - Attribution: You must give appropriate credit, provide a link to the license,
 *                 and indicate if changes were made.
 *  - NonCommercial: You may not use the material for commercial purposes.
 *  - No additional restrictions: You may not apply legal terms or technological 
 *                                measures that legally restrict others from doing
 *                                anything the license permits.
 */

import Renderer from "./lib/Viz/RayTracer.js";
import Camera from "./lib/Viz/3DCamera.js";
import RayTracingTriangleMeshObject from "./lib/Scene/RayTracingTriangleMeshObject.js";

const algorithmSteps = [
  {
    id: "original",
    title: "Original mesh"
  },
  {
    id: "voronoi",
    title: "Voronoi diagram"
  }
];

function currentStep() {
  const requested = window.location.hash.replace("#", "");
  return algorithmSteps.find(item => item.id === requested) ?? null;
}

function countVoronoiBoundaryEdges(graph, voronoi) {
  let boundaryEdges = 0;

  for (const edge of graph.primalEdges) {
    const owners = new Set();

    for (const face of edge.faces) {
      const owner = voronoi.owners[face];

      if (owner >= 0) {
        owners.add(owner);
      }
    }

    if (owners.size > 1) {
      boundaryEdges += 1;
    }
  }

  return boundaryEdges;
}

function buildMraTopology(mesh, siteCount = 12) {
  const dualGraph = mesh.buildDualGraph();
  const siteFaces = mesh.selectFarthestFaceSites(siteCount, 0);
  const voronoi = mesh.computeFaceVoronoi(siteFaces);
  const delaunayLike = mesh.buildDelaunayLikeTriangulation(voronoi);

  const summary = {
    dualGraph: mesh.summarizeFaceDualGraph(voronoi.distances),
    siteFaces,
    voronoiTileSizes: voronoi.tiles.map(tile => tile.length),
    voronoiBoundaryEdges: countVoronoiBoundaryEdges(dualGraph, voronoi),
    delaunayEdges: delaunayLike.edges.length,
    delaunayTriangles: delaunayLike.triangles.length,
    highValenceCorners: delaunayLike.highValenceCorners.length
  };

  return {
    dualGraph,
    siteFaces,
    voronoi,
    delaunayLike,
    summary
  };
}

function showPlainMenu() {
  document.body.innerHTML = "";

  for (let i = 0; i < algorithmSteps.length; ++i) {
    const step = algorithmSteps[i];
    const link = document.createElement("a");
    link.href = `#${step.id}`;
    link.textContent = step.title;
    document.body.appendChild(link);

    if (i < algorithmSteps.length - 1) {
      document.body.appendChild(document.createElement("br"));
    }
  }
}

async function init() {
  document.body.innerHTML = "";
  // Create a canvas tag
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);
  // Create a simple renderer
  const renderer = new Renderer(canvasTag);
  await renderer.init();
  // Create a 3D Camera
  var camera = new Camera();
  camera._isProjective = true;
  camera._pose[0] = 0.18809913098812103;
  camera._pose[1] = -0.0767698660492897;
  camera._pose[2] = -0.0767698660492897;
  camera._pose[3] = 0.18809913098812103;
  camera._pose[4] = -0.6141012907028198;
  camera._pose[5] = 0.29343530535697937;
  camera._pose[6] = 0.6404831409454346;
  camera._pose[15] = 0.20977813005447388;
  camera._focal[0] = 4;
  camera._focal[1] = 4;
  // Create a static triangle mesh object
  var mesh = new RayTracingTriangleMeshObject(
      renderer._device,
      renderer._canvasFormat,
      new URL("./assets/TOSCA/sphere.ply", import.meta.url).href,
      camera,
      new URL("./lib/Shaders/tracemesh.wgsl", import.meta.url).href
  );
  await renderer.setTracerObject(mesh);
  const mraTopology = buildMraTopology(mesh._mesh, 31);
  mesh.setVoronoiOverlay(mraTopology.voronoi, mraTopology.dualGraph);
  window.mraTopology = mraTopology;
  console.log("MRA topology", mraTopology.summary);
  function updateOverlayFromHash() {
    if (window.location.hash === "#voronoi") {
      mesh.setOverlayMode("voronoi");
    } else {
      mesh.setOverlayMode("original");
    }
  }

  window.addEventListener("hashchange", updateOverlayFromHash);
  updateOverlayFromHash();

  let moveSpeed = .1;
  let rotateSpeed = Math.PI / 36;
  let focalSpeed= .1;
  window.addEventListener("keydown", (e) => {
    switch (e.key){
      case "w": case "W":
        camera.moveY(moveSpeed);
        mesh.updateCameraPose();

        break;
      case "s": case "S":
        camera.moveY(-moveSpeed);
        mesh.updateCameraPose();
        break;
      case "a": case "A":
        camera.moveX(moveSpeed);
        mesh.updateCameraPose();

        break;
      case "d": case "D":
        camera.moveX(-moveSpeed);
        mesh.updateCameraPose();
        break;
      case "e": case "E":
        camera.moveZ(-moveSpeed);
        mesh.updateCameraPose();
        break;
      case "q": case "Q":
        camera.moveZ(moveSpeed);
        mesh.updateCameraPose();
        break;
      case "i": case "I":
        camera.rotateX(rotateSpeed);
        mesh.updateCameraPose();
        break;
      case "k": case "K":
        camera.rotateX(-rotateSpeed);
        mesh.updateCameraPose();
        break;
      case "j": case "J":
        camera.rotateY(rotateSpeed);
        mesh.updateCameraPose();
        break;
      case "l": case "L":
        camera.rotateY(-rotateSpeed);
        mesh.updateCameraPose();
        break;
      case "u": case "U":
        camera.rotateZ(rotateSpeed);
        mesh.updateCameraPose();
        break;
      case "o": case "O":
        camera.rotateZ(-rotateSpeed);
        mesh.updateCameraPose();
        break;
      case "[":
        camera.moveFocalx(focalSpeed);
        mesh.updateCameraFocal();
        break;
      case "]":
        camera.moveFocalx(-rotateSpeed);
        mesh.updateCameraFocal();
        break;
      case "{":
        camera.moveFocaly(focalSpeed);
        mesh.updateCameraFocal();
        break;
      case "}":
        camera.moveFocaly(-focalSpeed);
        mesh.updateCameraFocal();
        break;
    }
  });


  // run animation at 60 fps  
  var frameCnt = 0;
  var tgtFPS = 60;
  var secPerFrame = 1. / tgtFPS;
  var frameInterval = secPerFrame * 1000;
  var lastCalled;
  let renderFrame = () => {
    let elapsed = Date.now() - lastCalled;
    if (elapsed > frameInterval) {
      ++frameCnt;
      lastCalled = Date.now() - (elapsed % frameInterval);
      renderer.render();
    }
    requestAnimationFrame(renderFrame);
  };
  lastCalled = Date.now();
  renderFrame();
  setInterval(() => { 
    console.log('fps: ' + frameCnt);
    frameCnt = 0;
  }, 1000); // call every 1000 ms
  return renderer;
}

let appStarted = false;

function startAppForSelectedStep() {
  if (appStarted) {
    return;
  }

  const step = currentStep();

  if (!step) {
    showPlainMenu();
    return;
  }

  appStarted = true;
  init().then( ret => {
  console.log(ret);
  }).catch( error => {
    const pTag = document.createElement('p');
    pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
    document.body.appendChild(pTag);
    document.getElementById("renderCanvas")?.remove();
  });
}

window.addEventListener("hashchange", startAppForSelectedStep);
startAppForSelectedStep();
