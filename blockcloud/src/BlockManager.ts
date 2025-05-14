import * as THREE from 'three';
import { BlockTypes, BlockConfig, BlockState } from './types';

export class BlockManager {
    private scene: THREE.Scene;
    private blocks: Map<string, THREE.Mesh>;
    private blockConfigs: Map<BlockTypes, BlockConfig>;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.blocks = new Map();
        this.blockConfigs = this.initializeBlockConfigs();
    }

    private initializeBlockConfigs(): Map<BlockTypes, BlockConfig> {
        const configs = new Map<BlockTypes, BlockConfig>();
        
        configs.set(BlockTypes.VM, {
            type: BlockTypes.VM,
            color: 0x4CAF50,
            size: { width: 1, height: 1, depth: 1 },
            label: 'VM'
        });

        configs.set(BlockTypes.SECURITY_GROUP, {
            type: BlockTypes.SECURITY_GROUP,
            color: 0x2196F3,
            size: { width: 1, height: 0.5, depth: 1 },
            label: 'Security Group'
        });

        configs.set(BlockTypes.DATABASE, {
            type: BlockTypes.DATABASE,
            color: 0xFFC107,
            size: { width: 1, height: 1.5, depth: 1 },
            label: 'Database'
        });

        configs.set(BlockTypes.LOAD_BALANCER, {
            type: BlockTypes.LOAD_BALANCER,
            color: 0xF44336,
            size: { width: 2, height: 0.5, depth: 1 },
            label: 'Load Balancer'
        });

        return configs;
    }

    // preview: true이면 씬에 추가하지 않고 반환만 함
    public createBlock(type: BlockTypes, position: THREE.Vector3, preview = false): THREE.Mesh {
        const config = this.blockConfigs.get(type);
        if (!config) {
            throw new Error(`Unknown block type: ${type}`);
        }

        // 본체
        const geometry = new THREE.BoxGeometry(
            config.size.width,
            config.size.height,
            config.size.depth
        );
        const material = new THREE.MeshPhongMaterial({ color: config.color, opacity: preview ? 0.5 : 1, transparent: preview });
        const block = new THREE.Mesh(geometry, material);
        block.position.copy(position);
        block.userData = { type, config };

        // 레고 돌기(nub) 추가
        const nubs = this.createLegoNubs(config.size.width, config.size.depth, config.size.height);
        nubs.forEach(nub => block.add(nub));

        // 라벨 추가
        const label = this.createLabel(config.label);
        label.position.set(0, config.size.height / 2 + 0.18, 0);
        block.add(label);

        if (!preview) {
            this.scene.add(block);
            const id = `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            this.blocks.set(id, block);
        }
        return block;
    }

    private createLegoNubs(width: number, depth: number, height: number): THREE.Mesh[] {
        // 2x2 돌기(레고 느낌)
        const nubs: THREE.Mesh[] = [];
        const nubGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 32);
        const nubMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
        for (let x of [-0.25, 0.25]) {
            for (let z of [-0.25, 0.25]) {
                const nub = new THREE.Mesh(nubGeom, nubMat);
                nub.position.set(x * width, height / 2 + 0.09, z * depth);
                nubs.push(nub);
            }
        }
        return nubs;
    }

    private createLabel(text: string): THREE.Object3D {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');

        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = '24px Arial';
        context.fillStyle = '#000000';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1, 0.25, 1);

        return sprite;
    }

    public exportState(): BlockState[] {
        const states: BlockState[] = [];
        
        this.blocks.forEach((block, id) => {
            const type = this.getBlockType(block);
            if (type) {
                const config = this.blockConfigs.get(type);
                if (config) {
                    states.push({
                        id,
                        type,
                        position: {
                            x: block.position.x,
                            y: block.position.y,
                            z: block.position.z
                        },
                        config
                    });
                }
            }
        });

        return states;
    }

    private getBlockType(block: THREE.Mesh): BlockTypes | null {
        for (const [type, config] of this.blockConfigs.entries()) {
            if (block.material instanceof THREE.MeshPhongMaterial &&
                block.material.color.getHex() === config.color) {
                return type;
            }
        }
        return null;
    }

    // BlockCloud에서 블록 선택 시 사용
    public getBlockMeshes(): THREE.Mesh[] {
        return Array.from(this.blocks.values());
    }

    public getBlockInfo(block: THREE.Object3D): { label: string, type: string, position: { x: number, y: number, z: number }, color: number } | null {
        // block.userData에 정보가 있으면 반환
        if (block.userData && block.userData.config) {
            return {
                label: block.userData.config.label,
                type: block.userData.type,
                position: {
                    x: block.position.x,
                    y: block.position.y,
                    z: block.position.z
                },
                color: block.userData.config.color
            };
        }
        return null;
    }
} 