import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BlockType, BLOCK_CONFIG } from './blockTypes';
import { createBlockMesh, snapToGrid, canStack } from './blockUtils';

type BlockMesh = THREE.Mesh & { userData: { id: string, type: BlockType, config: any } };

class LegoBuilderApp {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    gridHelper: THREE.GridHelper;
    basePlate: THREE.Mesh;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    blocks: BlockMesh[] = [];
    selected: BlockMesh | null = null;
    dragType: BlockType | null = null;
    dragPreview: BlockMesh | null = null;
    draggingBlock: BlockMesh | null = null;
    dragOffset: { x: number, z: number } = { x: 0, z: 0 };
    isDraggingBlock: boolean = false;

    constructor() {
        // Three.js 기본 세팅
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe9ebf0);
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        this.camera.position.set(8, 12, 8);
        this.camera.lookAt(0, 0, 0);
        const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        // 조명
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        // 그리드/기본판 (원래대로: 진회색 단순 BoxGeometry)
        this.gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xcccccc);
        this.gridHelper.position.y = 0.01;
        this.scene.add(this.gridHelper);
        const baseGeo = new THREE.BoxGeometry(10, 0.4, 10);
        const baseMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
        this.basePlate = new THREE.Mesh(baseGeo, baseMat);
        this.basePlate.position.y = -0.2;
        this.basePlate.receiveShadow = true;
        this.scene.add(this.basePlate);

        // 이벤트
        window.addEventListener('resize', this.onResize.bind(this));
        this.onResize();
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('keydown', this.onKeyDown.bind(this));

        // Drag&Drop
        this.setupSidebarDrag();
        this.setupSidebarTabs();

        // Export 버튼
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            const state = this.exportState();
            alert(JSON.stringify(state, null, 2));
        });

        this.animate();
    }

    onResize() {
        const canvas = this.renderer.domElement;
        const width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth - 550;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    setupSidebarTabs() {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                tabContents.forEach(tc => (tc as HTMLElement).style.display = 'none');
                const tabName = tab.getAttribute('data-tab');
                const content = document.getElementById('tab-' + tabName);
                if (content) (content as HTMLElement).style.display = '';
            });
        });
    }

    setupSidebarDrag() {
        document.querySelectorAll('.block-card').forEach(card => {
            card.addEventListener('dragstart', (e: DragEvent) => {
                this.dragType = (card as HTMLElement).dataset.type as BlockType;
                // 프리뷰 블록
                this.dragPreview = createBlockMesh(this.dragType, { x: 0, y: 0.2, z: 0 }, '__preview');
                this.dragPreview.material.transparent = true;
                this.dragPreview.material.opacity = 0.5;
                this.scene.add(this.dragPreview);
            });
        });
        document.addEventListener('dragend', () => {
            if (this.dragPreview) {
                this.scene.remove(this.dragPreview);
                this.dragPreview = null;
            }
            this.dragType = null;
        });
        const canvas = this.renderer.domElement;
        canvas.addEventListener('dragover', e => e.preventDefault());
        canvas.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            if (!this.dragType) return;
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            // 쌓기: basePlate 또는 블록 위
            const blockIntersects = this.raycaster.intersectObjects(this.blocks, false);
            let y = 0.2;
            let stackTarget: BlockMesh | null = null;
            if (blockIntersects.length > 0) {
                stackTarget = blockIntersects[0].object as BlockMesh;
                if (!canStack(this.dragType, stackTarget.userData.type)) {
                    this.glowRed(stackTarget);
                    console.warn('VM 위에는 SG만 쌓을 수 있습니다.');
                    return;
                }
                y = stackTarget.position.y + stackTarget.userData.config.height;
            }
            else {
                // base plate 위에만 생성
                const baseIntersects = this.raycaster.intersectObject(this.basePlate);
                if (!baseIntersects.length) return;
            }
            const point = blockIntersects.length > 0 ? blockIntersects[0].point : this.raycaster.intersectObject(this.basePlate)[0].point;
            const { x, z } = snapToGrid(point.x, point.z);
            this.addBlock(this.dragType, { x, y, z });
            if (this.dragPreview) {
                this.scene.remove(this.dragPreview);
                this.dragPreview = null;
            }
            this.dragType = null;
        });
    }

    addBlock(type: BlockType, pos: { x: number, y: number, z: number }) {
        const id = `${type.toLowerCase()}-${Date.now()}`;
        const mesh = createBlockMesh(type, pos, id) as BlockMesh;
        mesh.userData.id = id;
        this.scene.add(mesh);
        this.blocks.push(mesh);
        mesh.cursor = 'pointer';
        // 클릭 선택 이벤트
        mesh.onBeforeRender = () => {};
    }

    onMouseDown(event: MouseEvent) {
        this.mouse.x = (event.offsetX / this.renderer.domElement.width) * 2 - 1;
        this.mouse.y = -(event.offsetY / this.renderer.domElement.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.blocks, false);
        if (intersects.length > 0) {
            this.draggingBlock = intersects[0].object as BlockMesh;
            this.isDraggingBlock = true;
            this.selectBlock(this.draggingBlock);
        } else {
            this.selectBlock(null);
        }
    }

    onMouseMove(event: MouseEvent) {
        if (this.isDraggingBlock && this.draggingBlock) {
            this.mouse.x = (event.offsetX / this.renderer.domElement.width) * 2 - 1;
            this.mouse.y = -(event.offsetY / this.renderer.domElement.height) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);

            // 쌓기: 다른 블록 위면 쌓기, 아니면 base plate 위에 snap
            const otherBlocks = this.blocks.filter(b => b !== this.draggingBlock);
            const stackIntersects = this.raycaster.intersectObjects(otherBlocks, false);
            let y = 0.2;
            let canStackHere = true;
            if (stackIntersects.length > 0) {
                const target = stackIntersects[0].object as BlockMesh;
                canStackHere = canStack(this.draggingBlock.userData.type, target.userData.type);
                if (canStackHere) {
                    y = target.position.y + target.userData.config.height;
                    this.draggingBlock.material.emissive.set(0x4f8cff);
                } else {
                    this.draggingBlock.material.emissive.set(0xff0000);
                }
                const { x, z } = snapToGrid(stackIntersects[0].point.x, stackIntersects[0].point.z);
                const topBlock = this.findTopBlockAt(x, z, this.draggingBlock);
                if (topBlock) {
                    // 쌓기 규칙 체크
                    if (!canStack(this.draggingBlock.userData.type, topBlock.userData.type)) {
                        this.draggingBlock.material.emissive.set(0xff0000);
                        return; // 쌓기 불가
                    }
                    y = topBlock.position.y + topBlock.userData.config.height;
                    // 같은 위치, 같은 높이에 이미 블록이 있으면 이동 불가
                    if (Math.abs(this.draggingBlock.position.y - y) < 0.01) {
                        this.draggingBlock.material.emissive.set(0xff0000);
                        return;
                    }
                }
                this.draggingBlock.position.set(x, y, z);
            } else {
                const baseIntersects = this.raycaster.intersectObject(this.basePlate);
                if (baseIntersects.length > 0) {
                    const { x, z } = snapToGrid(baseIntersects[0].point.x, baseIntersects[0].point.z);
                    this.draggingBlock.position.set(x, 0.2, z);
                    this.draggingBlock.material.emissive.set(0x4f8cff);
                }
            }
        }
    }

    onMouseUp() {
        if (this.isDraggingBlock && this.draggingBlock) {
            this.draggingBlock.material.emissive.set(0x000000);
            this.isDraggingBlock = false;
            this.draggingBlock = null;
        }
    }

    onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Delete' && this.selected) {
            this.scene.remove(this.selected);
            this.blocks = this.blocks.filter(b => b !== this.selected);
            this.selectBlock(null);
        }
    }

    selectBlock(block: BlockMesh | null) {
        if (this.selected) {
            (this.selected.material as THREE.MeshPhongMaterial).emissive.set(0x000000);
        }
        this.selected = block;
        if (block) {
            (block.material as THREE.MeshPhongMaterial).emissive.set(0x4f8cff);
            this.showProperty(block);
        } else {
            this.showProperty(null);
        }
    }

    glowRed(block: BlockMesh) {
        (block.material as THREE.MeshPhongMaterial).emissive.set(0xff0000);
        setTimeout(() => {
            (block.material as THREE.MeshPhongMaterial).emissive.set(0x000000);
        }, 600);
    }

    showProperty(block: BlockMesh | null) {
        const panel = document.getElementById('propertyContent');
        if (!panel) return;
        if (!block) {
            panel.innerHTML = '블록을 선택하면 속성이 표시됩니다.';
            return;
        }
        panel.innerHTML = `
            <b>ID:</b> ${block.userData.id}<br>
            <b>Type:</b> ${block.userData.type}<br>
            <b>Config:</b> <pre>${JSON.stringify(block.userData.config, null, 2)}</pre>
        `;
    }

    exportState() {
        return this.blocks.map(b => ({
            id: b.userData.id,
            type: b.userData.type,
            pos: { x: b.position.x, y: b.position.y, z: b.position.z },
            config: b.userData.config
        }));
    }

    findTopBlockAt(x: number, z: number, ignoreBlock?: BlockMesh): BlockMesh | null {
        let top: BlockMesh | null = null;
        for (const b of this.blocks) {
            if (b === ignoreBlock) continue;
            if (Math.round(b.position.x) === x && Math.round(b.position.z) === z) {
                if (!top || b.position.y > top.position.y) top = b;
            }
        }
        return top;
    }
}

new LegoBuilderApp(); 