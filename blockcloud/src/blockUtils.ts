import * as THREE from 'three';
import { BlockType, BLOCK_CONFIG } from './blockTypes';

/**
 * 블록 Mesh 생성 (레고 스타일)
 */
export function createBlockMesh(type: BlockType, pos: {x:number, y:number, z:number}, id: string): THREE.Mesh {
  const cfg = BLOCK_CONFIG[type];
  const geo = new THREE.BoxGeometry(0.9, cfg.height, 0.9);
  const mat = new THREE.MeshPhongMaterial({ color: cfg.color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, pos.y, pos.z);
  mesh.userData = { id, type, config: cfg };
  // 레고 돌기
  const nubGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.07, 24);
  for (let dx of [-0.22, 0.22]) for (let dz of [-0.22, 0.22]) {
    const nub = new THREE.Mesh(nubGeo, mat.clone());
    nub.position.set(dx, cfg.height/2+0.04, dz);
    mesh.add(nub);
  }
  return mesh;
}

/**
 * 격자 스냅
 */
export function snapToGrid(x: number, z: number) {
  return { x: Math.round(x), z: Math.round(z) };
}

/**
 * 쌓기 규칙 검사
 */
export function canStack(top: BlockType, bottom: BlockType): boolean {
  if (bottom === BlockType.VM) return (top === BlockType.SG /*|| top === BlockType.MON*/);
  return true;
} 