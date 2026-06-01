/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────
// DiscoveryPopup variants — vanilla DOM (Leaflet popup renders outside
// the React tree in the real app). All 4 variants render the same data
// shape; the host swaps the active variant at runtime.
// ──────────────────────────────────────────────────────────────────────

(function (global) {
  const ACTIVITY_LABEL = { hike: 'Hike', surf: 'Surf', snowboard: 'Snowboard' };
  const ACTIVITY_COLOR = { hike: '#16a34a', surf: '#0891b2', snowboard: '#2563eb' };

  const TAG_DISPLAY = {
    'boundary=national_park':  'National Park',
    'boundary=protected_area': 'Protected Area',
    'leisure=nature_reserve':  'Nature Reserve',
    'natural=peak':            'Peak',
    'route=hiking':            'Trail',
    'tourism=viewpoint':       'Viewpoint',
    'natural=beach':           'Beach',
    'leisure=beach_resort':    'Beach',
    'landuse=winter_sports':   'Ski Area',
    'aerialway':               'Ski Lift',
    'piste:type':              'Ski Run',
    'sport=skiing':            'Ski Area',
  };
  function friendlyTag(osmTag) {
    if (TAG_DISPLAY[osmTag]) return TAG_DISPLAY[osmTag];
    const tail = (osmTag || '').split('=').pop() || '';
    return tail.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || osmTag;
  }

  // ── Tag → small piece of extra signal for the meta row ──────────────
  // Strictly read OSM tags. Never fabricate values.
  function extraSignal(result) {
    const t = result.tags || {};
    if (t.ele) {
      const n = parseInt(t.ele, 10);
      if (!isNaN(n)) return `${n.toLocaleString()} m`;
    }
    if (t['piste:difficulty']) {
      return t['piste:difficulty'].toUpperCase();
    }
    if (t.surface) {
      return t.surface.replace(/_/g, ' ');
    }
    if (t.length) {
      const km = parseFloat(t.length);
      if (!isNaN(km)) return `${km} km`;
    }
    if (t.aerialway) {
      return t.aerialway.replace(/_/g, ' ');
    }
    return null;
  }

  // ── Tag → small set of tag chips for Variant D ──────────────────────
  function tagChips(result) {
    const t = result.tags || {};
    const out = [];
    if (t.ele) {
      const n = parseInt(t.ele, 10);
      if (!isNaN(n)) out.push({ k: 'Elev', v: `${n.toLocaleString()} m` });
    }
    if (t['piste:difficulty']) {
      out.push({ k: 'Grade', v: t['piste:difficulty'] });
    }
    if (t['piste:type']) {
      out.push({ k: 'Type', v: t['piste:type'].replace(/_/g, ' ') });
    }
    if (t.surface) {
      out.push({ k: 'Surface', v: t.surface.replace(/_/g, ' ') });
    }
    if (t.length) {
      const km = parseFloat(t.length);
      if (!isNaN(km)) out.push({ k: 'Length', v: `${km} km` });
    }
    if (t.aerialway) {
      out.push({ k: 'Lift', v: t.aerialway.replace(/_/g, ' ') });
    }
    if (t.operator && out.length < 3) {
      out.push({ k: 'Operator', v: t.operator });
    }
    return out.slice(0, 3);
  }

  // ── Tile math (Web Mercator, zoom level Z → tile XY) ────────────────
  function lonLatToTilePixel(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = ((lon + 180) / 360) * n * 256;
    const latRad = (lat * Math.PI) / 180;
    const y =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n *
      256;
    return { x, y };
  }

  // Build a 3x3 mosaic of CartoDB Positron tiles centred on the spot.
  function buildMapSnippet(lat, lon, accentColor, viewportW, viewportH) {
    const Z = 13;
    const { x: px, y: py } = lonLatToTilePixel(lat, lon, Z);
    const ctx = Math.floor(px / 256);
    const cty = Math.floor(py / 256);

    const tilesEl = document.createElement('div');
    tilesEl.className = 'tiles';

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = ctx + dx;
        const ty = cty + dy;
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'eager';
        img.decoding = 'async';
        // CartoDB Positron — clean, low-saturation basemap that matches
        // the rest of the app
        img.src = `https://a.basemaps.cartocdn.com/light_all/${Z}/${tx}/${ty}.png`;
        img.referrerPolicy = 'no-referrer';
        tilesEl.appendChild(img);
      }
    }

    // Mosaic top-left in absolute pixel space:
    const mosaicLeft = (ctx - 1) * 256;
    const mosaicTop  = (cty - 1) * 256;
    // Offset so the spot ends up at the viewport center:
    const offsetX = (px - mosaicLeft) - viewportW / 2;
    const offsetY = (py - mosaicTop)  - viewportH / 2;
    tilesEl.style.transform = `translate(${-offsetX}px, ${-offsetY}px)`;

    const root = document.createElement('div');
    root.className = 'map-snippet';
    root.appendChild(tilesEl);

    // Center pin overlay — matches the discovery teardrop on the map.
    const pin = document.createElement('div');
    pin.className = 'center-pin';
    pin.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="34" height="46">
        <path d="M18 46C18 46 34 29 34 17C34 8.2 26.8 1 18 1C9.2 1 2 8.2 2 17C2 29 18 46 18 46Z"
          fill="white" stroke="${accentColor}" stroke-width="2.5" stroke-dasharray="4 3"/>
        <circle cx="18" cy="18" r="4.5" fill="${accentColor}"/>
      </svg>`;
    root.appendChild(pin);

    const tint = document.createElement('div');
    tint.className = 'tint';
    root.appendChild(tint);

    return root;
  }

  // ── Reusable sub-renderers ──────────────────────────────────────────
  function renderHeroPhoto(display, accent, isLoading, viewport) {
    const vp = viewport || { w: 280, h: 168 };
    const hero = document.createElement('div');
    hero.className = 'pop-hero';
    if (isLoading) {
      hero.classList.add('skeleton');
      return hero;
    }
    if (display.photoUrl) {
      const img = document.createElement('img');
      img.alt = display.name || '';
      img.loading = 'eager';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = display.photoUrl;
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      img.addEventListener('error', () => {
        // Fallback: swap to map snippet if photo fails to load
        hero.innerHTML = '';
        hero.appendChild(buildMapSnippet(display._lat, display._lon, accent, vp.w, vp.h));
      }, { once: true });
      hero.appendChild(img);
      return hero;
    }
    // No photo — show map snippet
    hero.appendChild(buildMapSnippet(display._lat, display._lon, accent, vp.w, vp.h));
    return hero;
  }

  function renderChip(result) {
    const chip = document.createElement('span');
    chip.className = `pop-chip ${result.activity}`;
    chip.innerHTML = `<span class="dot" aria-hidden="true"></span>${ACTIVITY_LABEL[result.activity] || result.activity}`;
    return chip;
  }

  function renderAttribution(result, display) {
    const attr = document.createElement('div');
    attr.className = 'pop-attr';

    if (display.photoAttribution && display.articleTitle) {
      const a = document.createElement('a');
      a.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(display.articleTitle)}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Photo: Wikipedia';
      attr.appendChild(a);
      const sep = document.createElement('span');
      sep.className = 'sep'; sep.textContent = '·';
      attr.appendChild(sep);
      const cc = document.createElement('span');
      cc.textContent = 'CC BY-SA';
      attr.appendChild(cc);
    } else if (!display.photoUrl) {
      const span = document.createElement('span');
      span.textContent = 'Map: CartoDB · OSM';
      attr.appendChild(span);
    }

    const grow = document.createElement('span');
    grow.className = 'grow';
    attr.appendChild(grow);

    const osm = document.createElement('a');
    osm.href = `https://www.openstreetmap.org/${result.osmType}/${result.osmId}`;
    osm.target = '_blank';
    osm.rel = 'noopener noreferrer';
    osm.textContent = 'OSM ↗';
    attr.appendChild(osm);

    return attr;
  }

  function renderCTA(result, display, accent, onSave) {
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'pop-cta';
    cta.setAttribute('data-activity', result.activity);
    if (display.saved) cta.classList.add('is-saved');
    cta.innerHTML = display.saved
      ? `View report
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
         Save spot to see score`;
    cta.addEventListener('click', () => {
      display.saved = true;
      onSave && onSave();
    });
    return cta;
  }

  function metaParts(result) {
    const parts = [`${result.distanceKm.toFixed(1)} km`, friendlyTag(result.osmTag)];
    const extra = extraSignal(result);
    if (extra) parts.push(extra);
    return parts;
  }

  function renderMeta(result, opts) {
    const meta = document.createElement('div');
    meta.className = 'pop-meta' + (opts && opts.className ? ' ' + opts.className : '');
    const parts = metaParts(result);
    parts.forEach((p, i) => {
      if (i > 0) {
        const s = document.createElement('span');
        s.className = 'sep'; s.textContent = '·';
        meta.appendChild(s);
      }
      const span = document.createElement('span');
      span.textContent = p;
      meta.appendChild(span);
    });
    return meta;
  }

  // ──────────────────────────────────────────────────────────────────
  // VARIANT A — refined baseline
  // ──────────────────────────────────────────────────────────────────
  function renderVariantA(result, display, accent, onSave) {
    const root = document.createElement('div');
    root.className = 'pop v-a';

    const hero = renderHeroPhoto(display, accent, display.loading, { w: 280, h: 168 });
    const chipMount = document.createElement('div');
    chipMount.className = 'chip-mount';
    chipMount.appendChild(renderChip(result));
    hero.appendChild(chipMount);
    root.appendChild(hero);

    const body = document.createElement('div');
    body.className = 'pop-body';

    const name = document.createElement('div');
    name.className = 'pop-name';
    name.textContent = display.name;
    body.appendChild(name);

    body.appendChild(renderMeta(result));

    if (display.summary) {
      const p = document.createElement('p');
      p.className = 'pop-summary';
      p.textContent = display.summary;
      body.appendChild(p);
    }

    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'pop-cta-wrap';
    ctaWrap.appendChild(renderCTA(result, display, accent, onSave));
    body.appendChild(ctaWrap);

    const foot = document.createElement('div');
    foot.className = 'pop-foot';
    foot.appendChild(renderAttribution(result, display));
    body.appendChild(foot);

    root.appendChild(body);
    return root;
  }

  // ──────────────────────────────────────────────────────────────────
  // VARIANT B — name overlaid on photo
  // ──────────────────────────────────────────────────────────────────
  function renderVariantB(result, display, accent, onSave) {
    const root = document.createElement('div');
    root.className = 'pop v-b';

    const hero = renderHeroPhoto(display, accent, display.loading, { w: 280, h: 175 });

    if (!display.loading) {
      const scrim = document.createElement('div');
      scrim.className = 'scrim';
      hero.appendChild(scrim);

      const overlay = document.createElement('div');
      overlay.className = 'overlay-name';
      const nameEl = document.createElement('div');
      nameEl.className = 'name';
      nameEl.textContent = display.name;
      overlay.appendChild(nameEl);

      const m = document.createElement('div');
      m.className = 'meta';
      const parts = metaParts(result);
      parts.forEach((p, i) => {
        if (i > 0) {
          const s = document.createElement('span');
          s.className = 'sep'; s.textContent = '·';
          m.appendChild(s);
        }
        const span = document.createElement('span');
        span.textContent = p;
        m.appendChild(span);
      });
      overlay.appendChild(m);
      hero.appendChild(overlay);
    }
    root.appendChild(hero);

    const body = document.createElement('div');
    body.className = 'pop-body';

    if (display.summary) {
      const p = document.createElement('p');
      p.className = 'pop-summary';
      p.textContent = display.summary;
      body.appendChild(p);
    }

    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'pop-cta-wrap';
    ctaWrap.appendChild(renderCTA(result, display, accent, onSave));
    body.appendChild(ctaWrap);

    const foot = document.createElement('div');
    foot.className = 'pop-foot';
    foot.appendChild(renderAttribution(result, display));
    body.appendChild(foot);

    root.appendChild(body);
    return root;
  }

  // ──────────────────────────────────────────────────────────────────
  // VARIANT C — compact
  // ──────────────────────────────────────────────────────────────────
  function renderVariantC(result, display, accent, onSave) {
    const root = document.createElement('div');
    root.className = 'pop v-c';

    const row = document.createElement('div');
    row.className = 'pop-row';

    const hero = renderHeroPhoto(display, accent, display.loading, { w: 96, h: 96 });
    row.appendChild(hero);

    const side = document.createElement('div');
    side.className = 'pop-side';

    const chipMount = document.createElement('div');
    chipMount.className = 'chip-mount-inline';
    chipMount.appendChild(renderChip(result));
    side.appendChild(chipMount);

    const name = document.createElement('div');
    name.className = 'pop-name';
    name.textContent = display.name;
    side.appendChild(name);

    side.appendChild(renderMeta(result));

    row.appendChild(side);
    root.appendChild(row);

    const footRow = document.createElement('div');
    footRow.className = 'pop-foot-row';
    footRow.appendChild(renderCTA(result, display, accent, onSave));
    root.appendChild(footRow);

    const attr = renderAttribution(result, display);
    root.appendChild(attr);

    return root;
  }

  // ──────────────────────────────────────────────────────────────────
  // VARIANT D — editorial
  // ──────────────────────────────────────────────────────────────────
  function renderVariantD(result, display, accent, onSave) {
    const root = document.createElement('div');
    root.className = 'pop v-d';

    const hero = renderHeroPhoto(display, accent, display.loading, { w: 280, h: 168 });
    root.appendChild(hero);

    const body = document.createElement('div');
    body.className = 'pop-body';

    const kicker = document.createElement('div');
    kicker.className = `pop-kicker ${result.activity}`;
    kicker.innerHTML = `
      <span class="swatch ${result.activity}" aria-hidden="true"></span>
      ${friendlyTag(result.osmTag)}
      <em>· ${result.distanceKm.toFixed(1)} km away</em>
    `;
    body.appendChild(kicker);

    const name = document.createElement('div');
    name.className = 'pop-name';
    name.textContent = display.name;
    body.appendChild(name);

    const chips = tagChips(result);
    if (chips.length) {
      const wrap = document.createElement('div');
      wrap.className = 'pop-tags';
      chips.forEach(({ k, v }) => {
        const t = document.createElement('span');
        t.className = 'tag';
        t.innerHTML = `<span class="k">${k}</span><span>${v}</span>`;
        wrap.appendChild(t);
      });
      body.appendChild(wrap);
    }

    if (display.summary) {
      const p = document.createElement('p');
      p.className = 'pop-summary';
      p.textContent = display.summary;
      body.appendChild(p);
    }

    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'pop-cta-wrap';
    ctaWrap.appendChild(renderCTA(result, display, accent, onSave));
    body.appendChild(ctaWrap);

    const foot = document.createElement('div');
    foot.className = 'pop-foot';
    foot.appendChild(renderAttribution(result, display));
    body.appendChild(foot);

    root.appendChild(body);
    return root;
  }

  const RENDERERS = {
    a: renderVariantA,
    b: renderVariantB,
    c: renderVariantC,
    d: renderVariantD,
  };

  // ── Public entry: build a popup root for the given variant ──────────
  function buildPopup(variant, result, display, onSave) {
    const accent = ACTIVITY_COLOR[result.activity] || '#6366f1';
    const r = RENDERERS[variant] || RENDERERS.a;
    // pass lat/lon to map-snippet helper via display
    display._lat = result.lat;
    display._lon = result.lon;
    return r(result, display, accent, onSave);
  }

  global.WODiscoveryPopup = {
    build: buildPopup,
    ACTIVITY_LABEL,
    ACTIVITY_COLOR,
    friendlyTag,
  };
})(window);
