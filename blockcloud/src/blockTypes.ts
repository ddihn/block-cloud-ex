export enum BlockType {
  VM = 'VM',
  SG = 'SG',
  LB = 'LB'
}

export const BLOCK_CONFIG = {
  VM: {
    color: 0x4caf50,
    label: 'VM',
    height: 0.2,
    icon: '🖥️'
  },
  SG: {
    color: 0xff9800,
    label: 'SG',
    height: 0.18,
    icon: '🟧'
  },
  LB: {
    color: 0x2196f3,
    label: 'LB',
    height: 0.18,
    icon: '🟦'
  }
}; 