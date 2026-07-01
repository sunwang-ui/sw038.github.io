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
  },
  {
    id: "straightened",
    title: "Straightened Delaunay triangulation"
  },
  {
    id: "base",
    title: "Base mesh"
  },
  {
    id: "remesh",
    title: "Remesh"
  },
  {
    id: "approximation",
    title: "Approximation"
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

function readNonNegativeInteger(urlParams, name, defaultValue) {
  const value = Number(urlParams.get(name));

  return urlParams.has(name) && Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : defaultValue;
}

function readPositiveInteger(urlParams, name, defaultValue) {
  const value = Number(urlParams.get(name));

  return urlParams.has(name) && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : defaultValue;
}

function readNonNegativeNumber(urlParams, name, defaultValue) {
  const value = Number(urlParams.get(name));

  return urlParams.has(name) && Number.isFinite(value) && value >= 0
      ? value
      : defaultValue;
}

function setDatasetValues(element, values) {
  for (const [key, value] of Object.entries(values)) {
    element.dataset[key] = typeof value === "string"
        ? value
        : JSON.stringify(value);
  }
}

async function init() {
  const initializationStartedAt = performance.now();
  document.body.innerHTML = "";
  const urlParams = new URLSearchParams(window.location.search);
  const requestedMesh = urlParams.get("mesh");
  const availableMeshes = new Set([
    "sphere",
    "sphere2",
    "teapot",
    "chopper",
    "cat0",
    "cat10",
    "wolf0",
    "cow",
    "car",
    "mug"
  ]);
  const meshName = requestedMesh === "sphere"
      ? "sphere"
      : availableMeshes.has(requestedMesh)
          ? requestedMesh
          : "sphere";
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
      `./assets/TOSCA/${meshName}.ply`,
      camera,
      './lib/Shaders/tracemesh.wgsl'
  );
  await renderer.setTracerObject(mesh);
  canvasTag.dataset.mesh = meshName;
  const selectedStepId = currentStep()?.id ?? "original";
  const needsPartition = selectedStepId !== "original";
  const needsPaperTriangulation = selectedStepId === "delaunay"
      || selectedStepId === "straightened"
      || selectedStepId === "base"
      || selectedStepId === "remesh"
      || selectedStepId === "approximation";
  let dualGraph = null;

  if (needsPartition) {
    dualGraph = mesh._mesh.buildDualGraph();

    if (dualGraph.nonManifoldEdges.length > 0) {
      throw new Error(
          `Paper triangulation requires a manifold mesh; found ${dualGraph.nonManifoldEdges.length} non-manifold edges.`
      );
    }

    if (dualGraph.boundaryEdges.length > 0) {
      throw new Error(
          `Paper triangulation currently supports closed meshes only; found ${dualGraph.boundaryEdges.length} boundary edges.`
      );
    }

    canvasTag.dataset.meshClosedManifold = "true";
  }

  const defaultInitialSiteCount = selectedStepId === "remesh"
      || selectedStepId === "approximation"
      ? (meshName.startsWith("cat") || meshName === "mug" ? 16 : 32)
      : (meshName.startsWith("cat") || meshName === "mug")
          ? 16
          : 1;
  let partition = null;

  if (needsPartition) {
    const partitionStartedAt = performance.now();
    partition = mesh._mesh.selectHarmonicReadyFaceSites({
      initialSiteCount: readPositiveInteger(
          urlParams,
          "initialSites",
          defaultInitialSiteCount
      ),
      firstFace: readNonNegativeInteger(urlParams, "firstFace", 0),
      maxSites: readPositiveInteger(urlParams, "maxSites", 128),
      minTileCorners: 3,
      rejectShortCuts: true,
      shortCutRatio: 0.10,
      batchViolationSites: urlParams.get("batchSites") === "true"
    });

    if (!partition.validation.isValid || !partition.validation.isHarmonicReady) {
      const failureSummary = {
        sites: partition.siteFaces.length,
        reachedSiteLimit: partition.reachedSiteLimit,
        unassignedFaces: partition.validation.unassignedFaces?.length ?? 0,
        cellViolations: partition.validation.cellViolations?.length ?? 0,
        cutViolations: partition.validation.cutViolations?.length ?? 0,
        vertexViolations: partition.validation.vertexViolations?.length ?? 0,
        qualityViolations: partition.validation.qualityViolations?.length ?? 0,
        firstCellViolation: partition.validation.cellViolations?.[0] ?? null,
        firstCutViolation: partition.validation.cutViolations?.[0] ?? null,
        firstVertexViolation: partition.validation.vertexViolations?.[0] ?? null,
        firstQualityViolation: partition.validation.qualityViolations?.[0]
            ? {
              owner: partition.validation.qualityViolations[0].owner,
              cornerCount: partition.validation.qualityViolations[0].quality.cornerCount,
              shortPairs: partition.validation.qualityViolations[0].quality.shortPairs.length,
              boundaryLength: partition.validation.qualityViolations[0].quality.boundaryLength
            }
            : null
      };
      throw new Error(
          `Could not construct a harmonic-map-ready Voronoi partition: `
          + `${JSON.stringify(failureSummary)}.`
      );
    }

    canvasTag.dataset.partitionValid = "true";
    canvasTag.dataset.siteCount = String(partition.siteFaces.length);
    canvasTag.dataset.refinementSteps = String(partition.refinementSteps);
    canvasTag.dataset.partitionMilliseconds = String(
        performance.now() - partitionStartedAt
    );
    mesh.setVoronoiOverlay(partition.voronoi, dualGraph);
  }

  let baseComplex = null;
  let paperTriangulation = null;
  let remesh = null;
  let approximation = null;

  if (needsPaperTriangulation) {
    const baseComplexStartedAt = performance.now();
    baseComplex = mesh._mesh.buildDelaunayLikeTriangulation(partition.voronoi);
    const baseValidation = mesh._mesh.validateDelaunayLikeTriangulation(baseComplex);

    if (!baseValidation.isValid) {
      throw new Error("The induced Delaunay base complex is topologically invalid.");
    }

    canvasTag.dataset.baseComplexValid = "true";
    canvasTag.dataset.baseVertices = String(baseComplex.siteFaces.length);
    canvasTag.dataset.baseEdges = String(baseComplex.edges.length);
    canvasTag.dataset.baseFaces = String(baseComplex.triangles.length);
    canvasTag.dataset.baseComplexMilliseconds = String(
        performance.now() - baseComplexStartedAt
    );
    const paperTriangulationStartedAt = performance.now();
    const shouldStraightenEdges = selectedStepId === "straightened";
    paperTriangulation = mesh._mesh.buildPaperInitialDelaunay(
        partition.voronoi,
        baseComplex,
        {
          tolerance: 1e-10,
          tiles: partition.tiles,
          straightenEdges: shouldStraightenEdges
        }
    );
    canvasTag.dataset.paperTriangulationMilliseconds = String(
        performance.now() - paperTriangulationStartedAt
    );
    const baseMeshGeometry = {
      vertices: baseComplex.siteFaces.map((siteFace, owner) => {
        const refinedVertex =
            paperTriangulation.embedding.subdivision.faceCentroidIndices[siteFace];
        return paperTriangulation.embedding.subdivision.vertices[refinedVertex]
            ?? baseComplex.sitePositions[owner];
      }),
      triangles: baseComplex.triangles.map(triangle => [...triangle.sites])
    };
    mesh.setBaseMeshGeometry(baseMeshGeometry);
    canvasTag.dataset.baseMeshVertices = String(baseMeshGeometry.vertices.length);
    canvasTag.dataset.baseMeshFaces = String(baseMeshGeometry.triangles.length);
    const delaunayEmbedding = paperTriangulation.embedding;
    const embeddingValidation = mesh._mesh.validateEmbeddedDelaunayPaths(
        partition.voronoi,
        baseComplex,
        delaunayEmbedding
    );
    const harmonicPathsValid = paperTriangulation.paths.every(
        path => (path.construction === "harmonic"
                || path.construction === "harmonic-straightened")
            && path.facePath.length > 0
            && path.surfacePolyline.length >= 2
    );
    const patchComplex = paperTriangulation.patchComplex ?? null;
    const patchValidation = patchComplex
        ? mesh._mesh.validateBaseFacePatches(
            patchComplex,
            baseComplex
        )
        : {
          isValid: false,
          errors: [{
            type: "unavailable",
            message: "Harmonic refinement was not constructed."
          }]
        };

    canvasTag.dataset.topologyEmbeddingValid = String(
        embeddingValidation.isValid
    );
    canvasTag.dataset.topologyEmbeddingError =
        JSON.stringify(embeddingValidation.errors[0] ?? {});
    canvasTag.dataset.patchComplexValid = String(patchValidation.isValid);
    canvasTag.dataset.patchComplexError =
        JSON.stringify(patchValidation.errors[0] ?? {});
    canvasTag.dataset.patchCount = String(patchComplex?.patches.length ?? 0);
    canvasTag.dataset.delaunayPathsValid = String(
        harmonicPathsValid && embeddingValidation.isValid
    );
    canvasTag.dataset.delaunayPathCount = String(
        paperTriangulation.paths.length
    );
    canvasTag.dataset.harmonicTileCount = String(
        paperTriangulation.diagnostics.tileCount
    );
    canvasTag.dataset.harmonicWeightedSolves = String(
        paperTriangulation.diagnostics.weightedSolves
    );
    canvasTag.dataset.harmonicUniformSolves = String(
        paperTriangulation.diagnostics.uniformSolves
    );
    canvasTag.dataset.harmonicBoundaryRecoveryCount = String(
        paperTriangulation.diagnostics.boundaryRecoveryCount
    );
    canvasTag.dataset.harmonicMaxResidual = String(
        paperTriangulation.diagnostics.maxResidual
    );
    canvasTag.dataset.harmonicFlippedTriangles = String(
        paperTriangulation.diagnostics.flippedTriangles
    );
    canvasTag.dataset.harmonicDegenerateTriangles = String(
        paperTriangulation.diagnostics.degenerateTriangles
    );
    canvasTag.dataset.harmonicFirstWeightedError =
        paperTriangulation.diagnostics.firstWeightedError ?? "";
    canvasTag.dataset.harmonicFirstUniformError =
        paperTriangulation.diagnostics.firstUniformError ?? "";
    canvasTag.dataset.straighteningAttemptedEdges = String(
        paperTriangulation.diagnostics.straightening?.attemptedEdges ?? 0
    );
    canvasTag.dataset.straighteningEdges = String(
        paperTriangulation.diagnostics.straightening?.straightenedEdges ?? 0
    );
    canvasTag.dataset.straighteningWeightedSolves = String(
        paperTriangulation.diagnostics.straightening?.weightedSolves ?? 0
    );
    canvasTag.dataset.straighteningUniformSolves = String(
        paperTriangulation.diagnostics.straightening?.uniformSolves ?? 0
    );
    canvasTag.dataset.straighteningMaxResidual = String(
        paperTriangulation.diagnostics.straightening?.maxResidual ?? ""
    );
    canvasTag.dataset.straighteningFlippedTriangles = String(
        paperTriangulation.diagnostics.straightening?.flippedTriangles ?? ""
    );
    canvasTag.dataset.straighteningDegenerateTriangles = String(
        paperTriangulation.diagnostics.straightening?.degenerateTriangles ?? ""
    );
    canvasTag.dataset.straighteningFirstWeightedError =
        paperTriangulation.diagnostics.straightening?.firstWeightedError ?? "";
    canvasTag.dataset.refinedVertices = String(
        delaunayEmbedding.refinement?.vertices.length ?? 0
    );
    canvasTag.dataset.refinedFaces = String(
        delaunayEmbedding.refinement?.triangles.length ?? 0
    );
    canvasTag.dataset.constrainedEdgeCount = String(
        delaunayEmbedding.refinement?.surfaceConstrainedEdges.length ?? 0
    );
    canvasTag.dataset.refinementMode =
        delaunayEmbedding.refinement?.mode ?? "";
    canvasTag.dataset.refinedEuler = String(
        delaunayEmbedding.refinement?.validation?.eulerCharacteristic ?? ""
    );
    canvasTag.dataset.refinedBoundaryEdges = String(
        delaunayEmbedding.refinement?.validation?.boundaryEdges ?? ""
    );
    canvasTag.dataset.refinedNonManifoldEdges = String(
        delaunayEmbedding.refinement?.validation?.nonManifoldEdges ?? ""
    );
    canvasTag.dataset.refinedBoundaryKinds = JSON.stringify(
        delaunayEmbedding.refinement?.validation?.boundaryEdgeKinds ?? {}
    );
    canvasTag.dataset.refinedBoundarySamples = JSON.stringify(
        delaunayEmbedding.refinement?.validation?.boundarySamples ?? []
    );
    canvasTag.dataset.refinedEdgeCount = String(
        delaunayEmbedding.refinement?.validation?.edges ?? ""
    );
    canvasTag.dataset.refinedUsedVertices = String(
        delaunayEmbedding.refinement?.validation?.usedVertices ?? ""
    );
    canvasTag.dataset.refinedIncidenceHistogram = JSON.stringify(
        delaunayEmbedding.refinement?.validation?.incidenceHistogram ?? {}
    );

    if (selectedStepId === "remesh" || selectedStepId === "approximation") {
      const remeshLevel = readNonNegativeInteger(urlParams, "remeshLevel", 4);

      if (selectedStepId === "remesh") {
        const remeshStartedAt = performance.now();
        remesh = mesh._mesh.buildPatchRemesh(
            baseComplex,
            paperTriangulation,
            { level: remeshLevel }
        );
        mesh.setRemeshGeometry(remesh);
        setDatasetValues(canvasTag, {
          remeshLevel: remesh.diagnostics.level,
          remeshSubdivisionFactor: remesh.diagnostics.subdivisionFactor,
          remeshPatchCount: remesh.diagnostics.patchCount,
          remeshPatchSolves: remesh.diagnostics.patchSolves,
          remeshMaxPatchIterations: remesh.diagnostics.maxPatchIterations,
          remeshMaxPatchChange: remesh.diagnostics.maxPatchChange,
          remeshFlippedPatchTriangles:
              remesh.diagnostics.flippedPatchTriangles,
          remeshDegeneratePatchTriangles:
              remesh.diagnostics.degeneratePatchTriangles,
          remeshVertices: remesh.vertices.length,
          remeshFaces: remesh.triangles.length,
          remeshEuler: remesh.validation.eulerCharacteristic,
          remeshBoundaryEdges: remesh.validation.boundaryEdges,
          remeshNonManifoldEdges: remesh.validation.nonManifoldEdges,
          remeshDegenerateTriangles: remesh.validation.degenerateTriangles,
          remeshMilliseconds: performance.now() - remeshStartedAt
        });
      }
      else {
        const defaultApproximationLevel = meshName.startsWith("cat") ? 9 : 4;
        const approximationLevel = readNonNegativeInteger(
            urlParams,
            "approxLevel",
            defaultApproximationLevel
        );
        const epsilonPercent = readNonNegativeNumber(urlParams, "epsilon", 1.0);
        const approximationStartedAt = performance.now();
        approximation = mesh._mesh.buildPatchApproximation(
            baseComplex,
            paperTriangulation,
            {
              level: approximationLevel,
              epsilonPercent
            }
        );
        mesh.setApproximationGeometry(approximation);
        setDatasetValues(canvasTag, {
          approximationLevel: approximation.diagnostics.level,
          approximationSubdivisionFactor:
              approximation.diagnostics.subdivisionFactor,
          approximationEpsilonPercent:
              approximation.diagnostics.epsilonPercent,
          approximationErrorTolerance:
              approximation.diagnostics.errorTolerance,
          approximationMaxEstimatedError:
              approximation.diagnostics.maxEstimatedError,
          approximationMaxRetainedError:
              approximation.diagnostics.maxRetainedError,
          approximationPatchCount: approximation.diagnostics.patchCount,
          approximationPatchSolves: approximation.diagnostics.patchSolves,
          approximationAdaptiveSplits:
              approximation.diagnostics.adaptiveSplits,
          approximationConformitySplits:
              approximation.diagnostics.conformitySplits,
          approximationToleranceSatisfied:
              approximation.diagnostics.toleranceSatisfied,
          approximationReachedMaxLevel:
              approximation.diagnostics.reachedMaxLevel,
          approximationLeavesByLevel:
              approximation.diagnostics.retainedLeavesByLevel,
          approximationVertices: approximation.vertices.length,
          approximationFaces: approximation.triangles.length,
          approximationEuler: approximation.validation.eulerCharacteristic,
          approximationBoundaryEdges: approximation.validation.boundaryEdges,
          approximationNonManifoldEdges:
              approximation.validation.nonManifoldEdges,
          approximationDegenerateTriangles:
              approximation.validation.degenerateTriangles,
          approximationMilliseconds: performance.now() - approximationStartedAt
        });
      }
    }
  }
  canvasTag.dataset.initializationMilliseconds = String(
      performance.now() - initializationStartedAt
  );

  function renderSelectedStep() {
    if (selectedStepId === "voronoi") {
      mesh.useSurfaceGeometry();
      mesh.setOverlayMode("voronoi");
    }
    else if (selectedStepId === "delaunay") {
      mesh.useSurfaceGeometry();
      mesh.setDelaunayOverlay(
          partition.voronoi,
          { paths: paperTriangulation.initialPaths ?? paperTriangulation.paths },
          dualGraph
      );
      mesh.setOverlayMode("delaunay");
    }
    else if (selectedStepId === "straightened") {
      mesh.useSurfaceGeometry();
      mesh.setDelaunayOverlay(
          partition.voronoi,
          { paths: paperTriangulation.paths },
          dualGraph
      );
      mesh.setOverlayMode("straightened");
    }
    else if (selectedStepId === "base") {
      mesh.useBaseMeshGeometry();
      mesh.setOverlayMode("base");
    }
    else if (selectedStepId === "remesh") {
      mesh.useRemeshGeometry();
      mesh.setOverlayMode("remesh");
    }
    else if (selectedStepId === "approximation") {
      mesh.useApproximationGeometry();
      mesh.setOverlayMode("approximation");
    }
    else {
      mesh.useSurfaceGeometry();
      mesh.setOverlayMode("original");
    }

    renderer.render();
  }

  renderSelectedStep();

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

  const handleKeyDown = e => {
    const control = controls[e.key.toLowerCase()];

    if (!control) {
      return;
    }

    control();
    renderer.render();
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}

let appStarted = false;
let appStarting = false;
let activeStepId = null;
let activeAppCleanup = null;
let routeVersion = 0;
let appStartingVersion = null;

function startAppForSelectedStep() {
  const version = ++routeVersion;
  const step = currentStep();

  if (!step) {
    if (activeAppCleanup) {
      activeAppCleanup();
      activeAppCleanup = null;
    }

    appStarted = false;
    activeStepId = null;
    showPlainMenu();
    return;
  }

  if (appStarted && activeStepId === step.id) {
    return;
  }

  if (appStarted || appStarting) {
    window.location.reload();
    return;
  }

  appStarting = true;
  appStartingVersion = version;
  init()
      .then(cleanup => {
        if (version !== routeVersion || currentStep()?.id !== step.id) {
          cleanup?.();
          return;
        }

        activeAppCleanup = cleanup;
        activeStepId = step.id;
        appStarted = true;
      })
      .catch(error => {
        if (version !== routeVersion) {
          return;
        }

        const pTag = document.createElement("p");
        pTag.append(
            document.createTextNode(navigator.userAgent),
            document.createElement("br"),
            document.createTextNode(error.stack ?? error.message)
        );
        document.body.appendChild(pTag);
        document.getElementById("renderCanvas")?.remove();
      })
      .finally(() => {
        if (appStartingVersion === version) {
          appStarting = false;
          appStartingVersion = null;
        }
      });
}

window.addEventListener("hashchange", startAppForSelectedStep);
startAppForSelectedStep();
