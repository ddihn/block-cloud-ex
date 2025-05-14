import * as THREE from 'three';

export class Grid {
    public mesh: THREE.Group;
    public basePlate: THREE.Mesh;
    private size: number;
    private divisions: number;

    constructor(size: number, divisions: number) {
        this.size = size;
        this.divisions = divisions;
        const { group, basePlate } = this.createGridWithBase();
        this.mesh = group;
        this.basePlate = basePlate;
    }

    private createGridWithBase(): { group: THREE.Group, basePlate: THREE.Mesh } {
        // Create grid helper
        const gridHelper = new THREE.GridHelper(this.size, this.divisions);
        
        // Create base plate (thicker, colored, not draggable)
        const baseGeometry = new THREE.BoxGeometry(this.size, 0.3, this.size);
        const baseMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        const basePlate = new THREE.Mesh(baseGeometry, baseMaterial);
        basePlate.position.y = -0.15; // so grid is just above the plate
        basePlate.receiveShadow = true;
        basePlate.name = 'basePlate';

        // Create ground plane (transparent, for raycasting)
        const groundGeometry = new THREE.PlaneGeometry(this.size, this.size);
        const groundMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0.01;
        ground.name = 'groundPlane';

        // Combine
        const group = new THREE.Group();
        group.add(basePlate);
        group.add(gridHelper);
        group.add(ground);
        return { group, basePlate };
    }
} 