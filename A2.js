/*
 * UBC CPSC 314 2024W2
 * Assignment 2 Template
 */

import { setup, loadAndPlaceGLB } from "./js/setup.js";
import * as THREE from "./js/three.module.js";
import { SourceLoader } from "./js/SourceLoader.js";
import { THREEx } from "./js/KeyboardState.js";
import { CCDIKHelper, CCDIKSolver } from "./js/CCDIKSolver.js";
import { GLTFLoader } from "./js/GLTFLoader.js";

// Setup and return the scene and related objects.
// You should look into js/setup.js to see what exactly is done here.
const { renderer, scene, camera, worldFrame } = setup();

// Used THREE.Clock for animation
var clock = new THREE.Clock();

/////////////////////////////////
//   YOUR WORK STARTS BELOW    //
/////////////////////////////////

// Initialize uniforms

// As in A1 we position the sphere in the world solely using this uniform
// So the initial y-offset being 1.0 here is intended.
const sphereOffset = { type: "v3", value: new THREE.Vector3(0.0, 1.0, 0.0) };

// Distance threshold beyond which the armadillo should shoot lasers at the sphere (needed for Q1c).
const LaserDistance = 10.0;

// Materials: specifying uniforms and shaders
const sphereMaterial = new THREE.ShaderMaterial({
  uniforms: {
    sphereOffset: sphereOffset
  }
});
const eyeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    sphereOffset: sphereOffset
  }
});

const amardilloMaterial = new THREE.ShaderMaterial();

// TODO: make necessary changes to implement the laser eyes
// Load shaders.
const shaderFiles = [
  "glsl/sphere.vs.glsl",
  "glsl/sphere.fs.glsl",
  "glsl/eye.vs.glsl",
  "glsl/eye.fs.glsl"
];

new SourceLoader().load(shaderFiles, function(shaders) {
  sphereMaterial.vertexShader = shaders["glsl/sphere.vs.glsl"];
  sphereMaterial.fragmentShader = shaders["glsl/sphere.fs.glsl"];

  eyeMaterial.vertexShader = shaders["glsl/eye.vs.glsl"];
  eyeMaterial.fragmentShader = shaders["glsl/eye.fs.glsl"];
});

let ikSolver = null;
let ikHelper = null;
let wristIKTargetBone = null;
let arm_L = null;
let armadillo_W = null;
let neck_W = null;

function logHierarchy(object, indent = "") {
  console.log(indent + (object.name || object.type));
  object.children.forEach(child => logHierarchy(child, indent + "  "));
}

// TODO: Load and place the armadillo geometry in GLB format
// Look at the definition of loadOBJ to familiarize yourself with how each parameter
// affects the loaded object.
new GLTFLoader().load(
  "glb/armadillo.glb",
  function(armadillo) {
    armadillo.scene.position.set(0.0, 5.3, -8.0);
    armadillo.scene.rotation.y = Math.PI;
    armadillo.scene.scale.set(0.1, 0.1, 0.1);
    scene.add(armadillo.scene);
    armadillo_W = armadillo;
    // Print the hierarchy of the armadillo scene
    logHierarchy(armadillo.scene);

    // Add SkeletonHelper to visualize bones
    armadillo.scene.traverse(function(node) {
      if (node.isSkinnedMesh && node.skeleton && node.skeleton.bones) {
        const bonesLength = node.skeleton.bones.length;
        console.log("Skeleton has", bonesLength, "bones.");
        node.skeleton.bones.forEach((bone, idx) => {
          console.log(`Bone ${idx}: ${bone.name}`);
        });

        const skeletonHelper = new THREE.SkeletonHelper(armadillo.scene);
        scene.add(skeletonHelper);

        // Build a bone name to index map.
        const boneMap = {};
        node.skeleton.bones.forEach((bone, idx) => {
          boneMap[bone.name] = idx;
        });

        // Check that all required bones are present.
        if (
          boneMap["Shoulder_L"] !== undefined &&
          boneMap["Arm_L"] !== undefined &&
          boneMap["Forearm_L"] !== undefined &&
          boneMap["Wrist_L"] !== undefined &&
          boneMap["Wrist_IK_L"] !== undefined &&
          boneMap["Neck"] !== undefined
        ) {
          // Save target bone reference for tracking.
          wristIKTargetBone = node.skeleton.bones[boneMap["Wrist_IK_L"]];
          arm_L = node.skeleton.bones[boneMap["Arm_L"]];
          neck_W = node.skeleton.bones[boneMap["Neck"]];

          const leftArmIKChain = [
            {
              target: boneMap["Wrist_IK_L"],
              effector: boneMap["Wrist_L"],
              links: [
                {
                  index: boneMap["Forearm_L"]
                },
                {
                  index: boneMap["Arm_L"]
                }
              ]
            }
          ]; // Prevent bending backward

          ikSolver = new CCDIKSolver(node, leftArmIKChain);
          if (ikSolver) {
            ikHelper = ikSolver.createHelper();
          } else {
            console.log("ikSolver is not there!");
          }
          if (ikHelper) {
            ikHelper.visible = true;
          } else {
            console.log("ikHelper is not there!");
          }
          scene.add(ikHelper);
          console.log("Left arm IK chain set up using bone names.");
        } else {
          console.error(
            "Not all required bones were found in the skeleton: ",
            boneMap
          );
        }
      }
    });
  },
  function(armadillo) {
    console.log(
      armadillo.loaded / armadillo.total * 100 + "% of armadillo loaded"
    );
  },
  function(error) {
    console.log(error);
  }
);

// Create the main sphere geometry
// https://threejs.org/docs/#api/en/geometries/SphereGeometry
const sphereGeometry = new THREE.SphereGeometry(1.0, 32.0, 32.0);
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphere);

const sphereLight = new THREE.PointLight(0xffffff, 50.0, 100);
scene.add(sphereLight);

// Create an eye ball (left eye as example)
// HINT: Create two eye ball meshes from the same geometry.
const eyeGeometry = new THREE.SphereGeometry(1.0, 32, 32);
const eyeScale = 0.5;

const leftSocketPosition = new THREE.Vector3(-0.8, 12.4, -4.5);
const rightSocketPosition = new THREE.Vector3(+0.8, 12.4, -4.5);

function initializeEye(eyePosition) {
  const eyeSocket = new THREE.Object3D();
  eyeSocket.position.copy(eyePosition);

  const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eye.scale.copy(new THREE.Vector3(eyeScale, eyeScale, eyeScale));
  eyeSocket.add(eye);
  scene.add(eyeSocket);
  return eye;
}

let leftEye = initializeEye(leftSocketPosition);
let rightEye = initializeEye(rightSocketPosition);

// Create the laser geometry.
const laserGeometry = new THREE.CylinderGeometry(0.05, 0.05); // Adjust radius for thickness
laserGeometry.rotateX(Math.PI / 2);
const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
const leftLaser = new THREE.Mesh(laserGeometry, laserMaterial);
const rightLaser = new THREE.Mesh(laserGeometry, laserMaterial);
scene.add(leftLaser);
scene.add(rightLaser);

// Listen to keyboard events.
const keyboard = new THREEx.KeyboardState();

function updateLaser(laser, eyePosition, targetPosition) {
  const direction = new THREE.Vector3().subVectors(targetPosition, eyePosition);
  const distance = direction.length();
  if (distance <= LaserDistance) {
    const midpoint = eyePosition.clone().add(direction.multiplyScalar(0.5));
    laser.position.copy(midpoint);
    laser.scale.set(1, 1, distance);
    laser.lookAt(targetPosition);
    laser.visible = true;
  } else {
    laser.visible = false;
  }
}

function isPointInCone(point, apex, maxAngle) {
  const V = new THREE.Vector3().subVectors(point, apex); // Vector from apex to point
  const D = new THREE.Vector3(1, 0, 0); // Cone direction (downward)
  console.log(D);

  // Normalize both vectors
  V.normalize();
  D.normalize();

  // Calculate the cosine of the angle between V and D
  const cosTheta = V.dot(D);

  // Calculate the threshold for the maximum angle
  const cosMaxAngle = Math.cos(maxAngle);

  // Check if the point is inside the cone and on the "southern side"
  return cosTheta >= cosMaxAngle && point.y < apex.y;
}

function checkKeyboard() {
  if (keyboard.pressed("W")) sphereOffset.value.z -= 0.1;
  else if (keyboard.pressed("S")) sphereOffset.value.z += 0.1;

  if (keyboard.pressed("A")) sphereOffset.value.x -= 0.1;
  else if (keyboard.pressed("D")) sphereOffset.value.x += 0.1;

  if (keyboard.pressed("E")) sphereOffset.value.y -= 0.1;
  else if (keyboard.pressed("Q")) sphereOffset.value.y += 0.1;

  // update the look-at direction of the eyes according to the orb.
  const targetPosition = sphere.position.clone().add(sphereOffset.value);

  if (armadillo_W) {
    console.log(`armadillo is ${armadillo_W}`);
    if (wristIKTargetBone) {
      if (wristIKTargetBone.parent) {
        const localTargetPosition = targetPosition.clone();
        wristIKTargetBone.parent.updateMatrixWorld(true);
        // Convert sphere's world position to the parent’s local space.
        wristIKTargetBone.parent.worldToLocal(localTargetPosition);
        wristIKTargetBone.position.copy(localTargetPosition);
      } else {
        console.error("wristIKTargetBone has no parent!");
      }

      // Ensure neck_W position is in world coordinates
      const neckWorldPosition = new THREE.Vector3();
      neck_W.getWorldPosition(neckWorldPosition);

      console.log("Target Position:", targetPosition);
      console.log("Neck World Position:", neckWorldPosition);

      if (isPointInCone(targetPosition, neckWorldPosition, Math.PI / 2)) {
        leftEye.lookAt(targetPosition);
        rightEye.lookAt(targetPosition);
        // update laser.
        updateLaser(leftLaser, leftSocketPosition, targetPosition);
        updateLaser(rightLaser, rightSocketPosition, targetPosition);
      } else {
        leftEye.rotation.set(0, 0, 0);
        rightEye.rotation.set(0, 0, 0);
        leftLaser.visible = false;
        rightLaser.visible = false;
      }
      // if (isPointInCone(targetPosition, arm_L, Math.PI / 3)) {
      if (ikSolver) {
        ikSolver.update();
      }
      if (ikHelper) {
        ikHelper.updateMatrixWorld(true);
      }
      // }
    } else {
      console.error("wristIKTargetBone is not defined!");
    }
  }

  // Update hand (IK target) to track the center of the orb.

  // The following tells three.js that some uniforms might have changed.
  sphereMaterial.needsUpdate = true;
  eyeMaterial.needsUpdate = true;
  laserMaterial.needsUpdate = true;

  // Move the sphere light in the scene. This allows the floor to reflect the light as it moves.
  sphereLight.position.copy(sphereOffset.value);
}

// Setup update callback
function update() {
  checkKeyboard();

  requestAnimationFrame(update);
  renderer.render(scene, camera);
}

// Start the animation loop.
update();
