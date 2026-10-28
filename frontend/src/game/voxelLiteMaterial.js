import * as THREE from 'three';
// Vertex-lit voxel rendering for low-power GPUs: no per-pixel PBR or lighting loops. Day cycle via uBright/uTint.
export const voxelLiteMaterial=new THREE.RawShaderMaterial({
  uniforms:{uBright:{value:1},uTint:{value:new THREE.Color('#ffffff')}},
  vertexShader:`precision highp float;
    attribute vec3 position;attribute vec3 normal;attribute mat4 instanceMatrix;attribute vec3 instanceColor;
    uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float uBright;uniform vec3 uTint;varying vec3 vColor;
    void main(){vec3 n=normalize(mat3(instanceMatrix)*normal);
      float light=.67+max(0.,dot(n,normalize(vec3(-.4,.85,.45))))*.40;
      vec3 tint=mix(vec3(.89,.94,1.),vec3(1.,.93,.90),max(n.y,0.))*mix(vec3(1.),uTint,.55);
      vColor=pow(clamp(instanceColor*light*tint*uBright,0.,1.),vec3(1./2.2));
      gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);
    }`,
  fragmentShader:`precision mediump float;varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.);}`,
});
