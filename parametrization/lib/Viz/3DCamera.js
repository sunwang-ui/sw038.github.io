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

import PGA3D from "../Math/PGA3D.js";

export default class Camera {
  constructor(width, height) {
    this._pose = new Float32Array(Array(16).fill(0));
    this._pose[0] = 1;
    this._focal = new Float32Array(Array(2).fill(1));
    this._resolutions = new Float32Array([width, height]);
  }

  resetPose() {
    this._pose[0] = 1;
    for (let i = 1; i < 16; ++i) this._pose[i] = 0;
    this._focal[0] = 1;
    this._focal[1] = 1;
  }

  updatePose(newpose) {
    for (let i = 0; i < 16; ++i) this._pose[i] = newpose[i];
  }

  updateSize(width, height) {
    this._resolutions[0] = width;
    this._resolutions[1] = height;
  }
  moveFocalx(d){
    this._focal[0] = this._focal[0]+ d;
  }
  moveFocaly(d){
    this._focal[1] = this._focal[1]+ d;
  }
  moveX(d) {
    // TODO: write code to move the camera in the x-direction
    // Suggest to use PGA3D
    let dx = PGA3D.applyMotorToDir([d,0,0], this._pose);
    let dy = PGA3D.createTranslator( dx[0], dx[1],dx[2]);
    let newpose = PGA3D.normalizeMotor(PGA3D.geometricProduct(dy,this._pose ));
    this.updatePose(newpose);
  }

  moveY(d) {
    // TODO: write code to move the camera in the y-direction
    // Suggest to use PGA3D
    let dx = PGA3D.applyMotorToDir([0,d,0], this._pose);
    let dy = PGA3D.createTranslator( dx[0], dx[1],dx[2]);
    let newpose = PGA3D.normalizeMotor(PGA3D.geometricProduct(dy,this._pose ));
    this.updatePose(newpose);
  }

  moveZ(d) {
    // TODO: write code to move the camera in the z-direction
    // Suggest to use PGA3D


    let dx = PGA3D.applyMotorToDir([0,0,d], this._pose);
    let dy = PGA3D.createTranslator( dx[0], dx[1],dx[2]);
    let newpose = PGA3D.normalizeMotor(PGA3D.geometricProduct(dy,this._pose ));
    this.updatePose(newpose);
  }

  rotateX(d) {
    // TODO: write code to rotate the camera along its x-axis
    // Suggest to use PGA3D
    let pos = PGA3D.applyMotorToPoint([0, 0, 0], this._pose);
    let axis = PGA3D.applyMotorToDir([1,0,0], this._pose);

    let dy = PGA3D.createRotor(d, axis[0], axis[1], axis[2] , pos[0], pos[1], pos[2]);
    let newpose = PGA3D.normalizeMotor((PGA3D.geometricProduct(dy, this._pose)));
    this.updatePose(newpose);
  }

  rotateY(d) {
    // TODO: write code to rotate the camera along its y-axis
    // Suggest to use PGA3D
    let pos = PGA3D.applyMotorToPoint([0, 0, 0], this._pose);
    let axis = PGA3D.applyMotorToDir([0,1,0], this._pose);

    let dy = PGA3D.createRotor(d, axis[0], axis[1], axis[2] , pos[0], pos[1], pos[2]);
    let newpose = PGA3D.normalizeMotor((PGA3D.geometricProduct(dy, this._pose)));
    this.updatePose(newpose);
  }

  rotateZ(d) {
    // TODO: write code to rotate the camera along its z-axis
    // Suggest to use PGA3D
    let pos = PGA3D.applyMotorToPoint([0, 0, 0], this._pose);
    let axis = PGA3D.applyMotorToDir([0,0,1], this._pose);

    let dy = PGA3D.createRotor(d, axis[0], axis[1], axis[2] , pos[0], pos[1], pos[2]);
    let newpose = PGA3D.normalizeMotor((PGA3D.geometricProduct(dy, this._pose)));
    this.updatePose(newpose);
  }
}
