export interface Instrument {
  id: string;
  name: string;
  strings: number[];
  transpose: number;
  family: 'bowed' | 'guitar' | 'keyboard' | 'wind';
}
export const instrumentProfiles: Instrument[] = [
  {
    id: 'cello',
    name: '大提琴',
    strings: [36, 43, 50, 57],
    transpose: 0,
    family: 'bowed',
  },
  {
    id: 'violin',
    name: '小提琴',
    strings: [55, 62, 69, 76],
    transpose: 0,
    family: 'bowed',
  },
  {
    id: 'viola',
    name: '中提琴',
    strings: [48, 55, 62, 69],
    transpose: 0,
    family: 'bowed',
  },
  {
    id: 'bass',
    name: '低音提琴',
    strings: [28, 33, 38, 43],
    transpose: -12,
    family: 'bowed',
  },
  {
    id: 'guitar',
    name: '吉他',
    strings: [40, 45, 50, 55, 59, 64],
    transpose: -12,
    family: 'guitar',
  },
  {
    id: 'piano',
    name: '钢琴',
    strings: [],
    transpose: 0,
    family: 'keyboard',
  },
  {
    id: 'flute',
    name: '长笛',
    strings: [],
    transpose: 0,
    family: 'wind',
  },
  {
    id: 'clarinet',
    name: '降 B 单簧管',
    strings: [],
    transpose: -2,
    family: 'wind',
  },
  {
    id: 'oboe',
    name: '双簧管',
    strings: [],
    transpose: 0,
    family: 'wind',
  },
  {
    id: 'bassoon',
    name: '巴松',
    strings: [],
    transpose: 0,
    family: 'wind',
  },
  {
    id: 'saxophone',
    name: '降 E 中音萨克斯',
    strings: [],
    transpose: -9,
    family: 'wind',
  },
  {
    id: 'trumpet',
    name: '降 B 小号',
    strings: [],
    transpose: -2,
    family: 'wind',
  },
  {
    id: 'horn',
    name: 'F 调圆号',
    strings: [],
    transpose: -7,
    family: 'wind',
  },
  {
    id: 'trombone',
    name: '长号',
    strings: [],
    transpose: 0,
    family: 'wind',
  },
];
export const instrumentFor = (id: string) =>
  instrumentProfiles.find((i) => i.id === id) ?? instrumentProfiles[0];
