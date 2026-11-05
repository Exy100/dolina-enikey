/* Отдельный путь для каждого героя. Старый формат сохранения остаётся сверху,
   архив других путей — в journeyState. Одна запись localStorage переключается
   целиком: при переполнении хранилища прежний путь остаётся нетронутым. */
const HeroJourneys = (() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  const snapshot = value => { const { journeyState, ...data } = value; return copy(data); };
  function open(storage, key, ids, blank) {
    const valid = id => ids.includes(id);
    const read = () => {
      const raw = storage.getItem(key);
      if (!raw) return blank();
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid save');
      return data;
    };
    const metadata = data => {
      const old = data.journeyState;
      const skin = data.gear && (data.gear.skin === 'pixel' ? 'qubit' : data.gear.skin);
      const active = old && valid(old.active) ? old.active : valid(skin) ? skin : ids[0];
      const paths = {};
      if (old && old.paths) ids.forEach(id => {
        const path = old.paths[id];
        if (path && typeof path === 'object' && !Array.isArray(path)) paths[id] = snapshot(path);
      });
      return { version: 1, active, paths };
    };
    const initial = read();
    let active = metadata(initial).active;
    function persist(current) {
      const latest = read(), meta = metadata(latest), own = snapshot(current);
      if (meta.active === active) {
        delete meta.paths[active];
        storage.setItem(key, JSON.stringify({ ...own, journeyState: meta }));
      } else {
        // Другая вкладка выбрала другого героя: обновляем только наш архив.
        meta.paths[active] = own;
        storage.setItem(key, JSON.stringify({ ...snapshot(latest), journeyState: meta }));
      }
    }
    function entries(current) {
      const latest = read(), meta = metadata(latest), paths = meta.paths;
      paths[meta.active] = snapshot(latest);
      paths[active] = snapshot(current);
      return paths;
    }
    function select(id, current) {
      if (!valid(id)) throw new Error('Unknown hero');
      const latest = read(), meta = metadata(latest), paths = meta.paths;
      paths[meta.active] = snapshot(latest);
      paths[active] = snapshot(current);
      const fresh = !paths[id];
      const next = fresh ? blank() : paths[id];
      next.gear = { ...(next.gear || {}), skin: id };
      next.journeyStarted = true;
      // Доступность и громкость общие, учебные результаты — отдельные.
      ['mute', 'lite', 'big'].forEach(k => { if (current[k] !== undefined) next[k] = current[k]; });
      delete paths[id];
      storage.setItem(key, JSON.stringify({ ...next, journeyState: { version: 1, active: id, paths } }));
      active = id;
      return { save: copy(next), fresh };
    }
    return { get active() { return active; }, load: () => snapshot(initial), persist, entries, select };
  }
  return { open };
})();
if (typeof module !== 'undefined') module.exports = HeroJourneys;
