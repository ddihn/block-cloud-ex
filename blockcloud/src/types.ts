export enum BlockTypes {
    VM = 'VM',
    SECURITY_GROUP = 'SECURITY_GROUP',
    DATABASE = 'DATABASE',
    LOAD_BALANCER = 'LOAD_BALANCER'
}

export interface BlockConfig {
    type: BlockTypes;
    color: number;
    size: {
        width: number;
        height: number;
        depth: number;
    };
    label: string;
}

export interface BlockState {
    id: string;
    type: BlockTypes;
    position: {
        x: number;
        y: number;
        z: number;
    };
    config: BlockConfig;
} 