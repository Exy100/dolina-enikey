/* Прокачка героя: уровень за звёзды во всём курсе и снаряжение, которое видно на герое в 3D */
const HeroGear = (() => {
  // Уровень считается по звёздам. Добавишь уроки — добавь и уровни, чтобы последний был достижим.
  const LEVELS = [
    { stars: 0, title: 'Новичок' },
    { stars: 3, title: 'Ученик' },
    { stars: 8, title: 'Путник' },
    { stars: 14, title: 'Следопыт' },
    { stars: 22, title: 'Исследователь' },
    { stars: 31, title: 'Знаток' },
    { stars: 41, title: 'Мастер' },
    { stars: 52, title: 'Изобретатель' },
    { stars: 62, title: 'Мудрец' },
    { stars: 72, title: 'Инженер' },
    { stars: 84, title: 'Архитектор' },
    { stars: 97, title: 'Магистр кода' },
    { stars: 111, title: 'Защитник долины' },
    { stars: 126, title: 'Герой долины' },
    { stars: 142, title: 'Великий программист' },
    { stars: 158, title: 'Легенда долины' },
  ];
  // На каждый слот надевается одна вещь. level — с какого уровня открывается.
  const SLOTS = { head: 'голова', face: 'лицо', neck: 'шея', back: 'спина', pet: 'питомец', color: 'цвет' };
  const ITEMS = [
    { id: 'scarf', name: 'Шарф', slot: 'neck', level: 2 },
    { id: 'bag', name: 'Рюкзак', slot: 'back', level: 3 },
    { id: 'hat', name: 'Шляпа путника', slot: 'head', level: 4 },
    { id: 'mint', name: 'Мятный корпус', slot: 'color', level: 5, colors: [0x1fb89a, 0x6fe3c8] },
    { id: 'cape', name: 'Плащ', slot: 'back', level: 6 },
    { id: 'firefly', name: 'Светлячок', slot: 'pet', level: 7 },
    { id: 'fire', name: 'Огненный корпус', slot: 'color', level: 8, colors: [0xe8552e, 0xff9a6b] },
    { id: 'crown', name: 'Корона', slot: 'head', level: 9 },
    { id: 'gold', name: 'Золотой корпус', slot: 'color', level: 10, colors: [0xd9a21b, 0xffd76a] },
    { id: 'glasses', name: 'Очки изобретателя', slot: 'face', level: 11 },
    { id: 'wings', name: 'Крылья', slot: 'back', level: 12 },
    { id: 'night', name: 'Ночной корпус', slot: 'color', level: 13, colors: [0x2b2f5c, 0x4a5190] },
    { id: 'spark', name: 'Искорка', slot: 'pet', level: 14 },
    { id: 'helmet', name: 'Шлем рыцаря', slot: 'head', level: 15 },
    { id: 'cosmic', name: 'Космический корпус', slot: 'color', level: 16, colors: [0xff4fa3, 0x7ee8ff] },
  ];
  const DEFAULT_COLORS = [0x6a55ea, 0x8f7cff]; // корпус и голова

  // Номер уровня (с 1) по числу звёзд
  function levelFor(stars) {
    let n = 0;
    LEVELS.forEach((l, i) => { if (stars >= l.stars) n = i; });
    return n + 1;
  }

  // 3D-модель вещи в координатах героя: он смотрит в +z, голова на высоте 0.62.
  // THREE передаётся снаружи, чтобы тесты могли читать данные без трёхмерки.
  function build(id, THREE) {
    const g = new THREE.Group();
    const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6 }, extra));
    const add = (geo, m, x, y, z) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      o.castShadow = true;
      g.add(o);
      return o;
    };
    switch (id) {
      case 'scarf': {
        const m = mat(0xe4572e);
        add(new THREE.TorusGeometry(0.19, 0.05, 8, 20), m, 0, 0.45, 0).rotation.x = Math.PI / 2;
        add(new THREE.BoxGeometry(0.08, 0.2, 0.04), m, 0.09, 0.36, -0.2).rotation.z = 0.2;
        break;
      }
      case 'bag':
        add(new THREE.BoxGeometry(0.26, 0.26, 0.12), mat(0x8a5a2b), 0, 0.3, -0.27);
        add(new THREE.BoxGeometry(0.27, 0.07, 0.13), mat(0x6b4220), 0, 0.41, -0.27);
        break;
      case 'hat': {
        const m = mat(0x4a3b2a);
        // поля не шире 0.25: иначе с высоты камеры они закрывают глаза
        add(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 24), m, 0, 0.8, 0);
        add(new THREE.CylinderGeometry(0.13, 0.16, 0.18, 20), m, 0, 0.9, 0);
        add(new THREE.CylinderGeometry(0.162, 0.162, 0.04, 20), mat(0xe4572e), 0, 0.83, 0);
        break;
      }
      case 'cape':
        // полцилиндра за спиной: угол 0 — перед героя, поэтому от π/2 до 3π/2
        add(new THREE.CylinderGeometry(0.23, 0.32, 0.46, 18, 1, true, Math.PI / 2, Math.PI),
          mat(0x3a2e8c, { side: THREE.DoubleSide }), 0, 0.26, 0);
        break;
      case 'firefly':
        add(new THREE.SphereGeometry(0.055, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xd8ff7a, emissive: 0xb6ff3a, emissiveIntensity: 1 }), 0, 0, 0);
        break;
      case 'glasses': {
        const m = mat(0x1b1e3c, { metalness: 0.4 });
        [-0.085, 0.085].forEach(x => add(new THREE.TorusGeometry(0.06, 0.012, 8, 20), m, x, 0.65, 0.225));
        add(new THREE.BoxGeometry(0.06, 0.015, 0.015), m, 0, 0.66, 0.225);
        break;
      }
      case 'wings': {
        const m = mat(0xf2f4ff, { transparent: true, opacity: 0.85, side: THREE.DoubleSide });
        [-1, 1].forEach(s => {
          const w = add(new THREE.BoxGeometry(0.02, 0.34, 0.24), m, s * 0.16, 0.42, -0.24);
          w.rotation.set(-0.3, s * 0.5, s * 0.35);
        });
        break;
      }
      case 'spark':
        add(new THREE.SphereGeometry(0.065, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xffb36b, emissive: 0xff6a00, emissiveIntensity: 1 }), 0, 0, 0);
        break;
      case 'helmet': {
        const m = mat(0xb8c0d8, { metalness: 0.6, roughness: 0.35 });
        add(new THREE.SphereGeometry(0.225, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.64, 0);
        add(new THREE.BoxGeometry(0.04, 0.12, 0.3), mat(0xe4572e), 0, 0.9, -0.02);
        break;
      }
      case 'crown': {
        const m = mat(0xffc83d, { emissive: 0x6b4500, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide });
        add(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 20, 1, true), m, 0, 0.8, 0);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(new THREE.ConeGeometry(0.04, 0.1, 6), m, Math.sin(a) * 0.15, 0.89, Math.cos(a) * 0.15);
        }
        break;
      }
    }
    return g;
  }

  return { LEVELS, SLOTS, ITEMS, DEFAULT_COLORS, levelFor, build };
})();
if (typeof module !== 'undefined') module.exports = HeroGear;
