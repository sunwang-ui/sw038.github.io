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

import Renderer from './lib/Viz/RayTracer.js'
import Camera from './lib/Viz/3DCamera.js'
import RayTracingTriangleMeshObject from './lib/Scene/RayTracingTriangleMeshObject.js'

const algorithmSteps = [
  {
    id: "original",
    title: "Original mesh"
  },
  {
    id: "voronoi",
    title: "Voronoi diagram"
  },
  {
    id: "delaunay",
    title: "Delaunay triangulation"
  }
];

function currentStep() {
  const requested = window.location.hash.replace("#", "");
  return algorithmSteps.find(item => item.id === requested) ?? null;
}

function showPlainMenu() {
  document.body.innerHTML = "";

  const menu = document.createElement("div");
  menu.style.display = "flex";
  menu.style.flexDirection = "column";
  menu.style.alignItems = "center";
  menu.style.gap = "12px";
  menu.style.width = "100%";

  for (const step of algorithmSteps) {
    const link = document.createElement("a");
    link.href = `#${step.id}`;
    link.textContent = step.title;
    menu.appendChild(link);
  }

  document.body.appendChild(menu);
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
  const camera = new Camera();
  camera._isProjective = true;
  camera._pose[0] = 0.18809913098812103;
  camera._pose[1] = -0.0767698660492897;
  camera._pose[2] = -0.0767698660492897;
  camera._pose[3] = 0.18809913098812103;
  camera._pose[4] = -0.6141012907028198;
  camera._pose[5] = 0.29343530535697937;
  camera._pose[6] = 0.6404831409454346;
  camera._pose[15] = 0.20977813005447388;
  camera._focal[0] = .25;
  camera._focal[1] = .25;
  // Create a static triangle mesh object
  const mesh = new RayTracingTriangleMeshObject(
      renderer._device,
      renderer._canvasFormat,
      './assets/TOSCA/sphere.ply',
      camera,
      './lib/Shaders/tracemesh.wgsl'
  );
  await renderer.setTracerObject(mesh);
  const dualGraph = mesh._mesh.buildDualGraph();
  const partition = mesh._mesh.selectTopologyValidFaceSites({
    initialSiteCount: 1,
    firstFace: 0,
    maxSites: 128
  });

  if (!partition.validation.isValid) {
    throw new Error(
        `Could not construct a topology-valid Voronoi partition within ${partition.siteFaces.length} sites.`
    );
  }

  canvasTag.dataset.partitionValid = "true";
  canvasTag.dataset.siteCount = String(partition.siteFaces.length);
  canvasTag.dataset.refinementSteps = String(partition.refinementSteps);
  const baseComplex = mesh._mesh.buildDelaunayLikeTriangulation(partition.voronoi);
  const baseValidation = mesh._mesh.validateDelaunayLikeTriangulation(baseComplex);

  if (!baseValidation.isValid) {
    throw new Error("The induced Delaunay base complex is topologically invalid.");
  }

  canvasTag.dataset.baseComplexValid = "true";
  canvasTag.dataset.baseVertices = String(baseComplex.siteFaces.length);
  canvasTag.dataset.baseEdges = String(baseComplex.edges.length);
  canvasTag.dataset.baseFaces = String(baseComplex.triangles.length);
  const delaunayEmbedding = mesh._mesh.embedDelaunayPaths(
      partition.voronoi,
      baseComplex
  );
  const embeddingValidation = mesh._mesh.validateEmbeddedDelaunayPaths(
      partition.voronoi,
      baseComplex,
      delaunayEmbedding
  );

  if (!embeddingValidation.isValid) {
    throw new Error("The embedded Delaunay paths intersect or cross invalid Voronoi cuts.");
  }

  const patchComplex = mesh._mesh.extractBaseFacePatches(
      partition.voronoi,
      baseComplex,
      delaunayEmbedding
  );
  const patchValidation = mesh._mesh.validateBaseFacePatches(
      patchComplex,
      baseComplex
  );

  if (!patchValidation.isValid) {
    throw new Error("The embedded Delaunay paths do not form valid base-face patches.");
  }

  canvasTag.dataset.patchComplexValid = "true";
  canvasTag.dataset.patchCount = String(patchComplex.patches.length);
  canvasTag.dataset.delaunayPathsValid = "true";
  canvasTag.dataset.delaunayPathCount = String(delaunayEmbedding.paths.length);
  mesh.setVoronoiOverlay(partition.voronoi, dualGraph);
  mesh.setDelaunayOverlay(partition.voronoi, delaunayEmbedding, dualGraph);

  function updateOverlayFromHash() {
    if (window.location.hash === "#voronoi") {
      mesh.setOverlayMode("voronoi");
    }
    else if (window.location.hash === "#delaunay") {
      mesh.setOverlayMode("delaunay");
    }
    else {
      mesh.setOverlayMode("original");
    }

    renderer.render();
  }

  window.addEventListener("hashchange", updateOverlayFromHash);
  updateOverlayFromHash();

  const moveSpeed = .1;
  const rotateSpeed = Math.PI / 36;
  const focalSpeed = .1;
  const updatePose = action => {
    action();
    mesh.updateCameraPose();
  };
  const updateFocal = action => {
    action();
    mesh.updateCameraFocal();
  };
  const controls = {
    w: () => updatePose(() => camera.moveY(moveSpeed)),
    s: () => updatePose(() => camera.moveY(-moveSpeed)),
    a: () => updatePose(() => camera.moveX(moveSpeed)),
    d: () => updatePose(() => camera.moveX(-moveSpeed)),
    e: () => updatePose(() => camera.moveZ(-moveSpeed)),
    q: () => updatePose(() => camera.moveZ(moveSpeed)),
    i: () => updatePose(() => camera.rotateX(rotateSpeed)),
    k: () => updatePose(() => camera.rotateX(-rotateSpeed)),
    j: () => updatePose(() => camera.rotateY(rotateSpeed)),
    l: () => updatePose(() => camera.rotateY(-rotateSpeed)),
    u: () => updatePose(() => camera.rotateZ(rotateSpeed)),
    o: () => updatePose(() => camera.rotateZ(-rotateSpeed)),
    "[": () => updateFocal(() => camera.moveFocalx(focalSpeed)),
    "]": () => updateFocal(() => camera.moveFocalx(-focalSpeed)),
    "{": () => updateFocal(() => camera.moveFocaly(focalSpeed)),
    "}": () => updateFocal(() => camera.moveFocaly(-focalSpeed))
  };

  window.addEventListener("keydown", (e) => {
    const control = controls[e.key.toLowerCase()];

    if (!control) {
      return;
    }

    control();
    renderer.render();
  });
}

let appStarted = false;
let appStarting = false;

function startAppForSelectedStep() {
  const step = currentStep();

  if (!step) {
    if (appStarted || appStarting) {
      window.location.reload();
      return;
    }

    showPlainMenu();
    return;
  }

  if (appStarted || appStarting) {
    return;
  }

  appStarting = true;
  init()
      .then(() => {
        appStarted = true;
      })
      .catch(error => {
        const pTag = document.createElement("p");
        pTag.append(
            document.createTextNode(navigator.userAgent),
            document.createElement("br"),
            document.createTextNode(error.message)
        );
        document.body.appendChild(pTag);
        document.getElementById("renderCanvas")?.remove();
      })
      .finally(() => {
        appStarting = false;
      });
}

window.addEventListener("hashchange", startAppForSelectedStep);
startAppForSelectedStep();
