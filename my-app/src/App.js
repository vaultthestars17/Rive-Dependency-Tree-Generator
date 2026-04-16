import logo from './logo.svg';
import './App.css';

import ReactDOM from 'react-dom';
import './index.css';

import React, { useEffect, useState } from 'react';
import xmlJs from 'xml-js';

// Helpers to turn compact xml-js objects into a generic tree and render as SVG.
function buildHierarchyFromXml(xmlRoot) {
  let nextId = 1;
  const makeId = () => `n${nextId++}`;

  const isXmlElement = (val) =>
    !!val && typeof val === 'object' && !Array.isArray(val);

  function shouldSkipKey(keyLower) {
    if (keyLower === 'statemachine' || keyLower.includes('keyframe')) {
      return true;
    }
    // Exclude all animation nodes and their children
    if (keyLower.includes('animation')) {
      return true;
    }
    const hasConstraint = keyLower.includes('constraint');
    const hasBind =
      keyLower.includes('databind') ||
      keyLower.includes('data_bind') ||
      keyLower.includes('binding') ||
      keyLower.includes('bind');
    if (hasConstraint && hasBind) {
      return true;
    }
    return false;
  }

  function nodesFromKeyAndValue(key, value) {
    const keyLower = String(key).toLowerCase();
    // Disregard StateMachine, keyframes, and data-bind constraints
    if (shouldSkipKey(keyLower)) {
      return [];
    }
    if (Array.isArray(value)) {
      return value
        .filter((el) => isXmlElement(el))
        .map((el, idx) => nodeFromEntry(key, el, idx));
    }
    if (isXmlElement(value)) {
      return [nodeFromEntry(key, value)];
    }
    return [];
  }

  function nodeFromEntry(tagName, elementObj, idx) {
    const tagLower = String(tagName).toLowerCase();
    const nameAttr =
      elementObj?._attributes?.name ??
      elementObj?._attributes?.id ??
      (typeof idx === 'number' ? `${tagName}[${idx}]` : tagName);
    const node = {
      id: makeId(),
      name: `${tagName}${nameAttr ? `: ${nameAttr}` : ''}`,
      tag: String(tagName),
      xmlId: elementObj?._attributes?.id ?? null,
      attrs: elementObj?._attributes ?? {},
      children: [],
    };
    // Do not recurse into Shape nodes (skip PointsPath/Fill/Stroke etc)
    if (tagLower !== 'shape') {
      Object.keys(elementObj || {}).forEach((childKey) => {
        if (childKey === '_attributes' || childKey === '_text' || childKey === '_cdata') {
          return;
        }
        const childVal = elementObj[childKey];
        const childNodes = nodesFromKeyAndValue(childKey, childVal);
        node.children.push(...childNodes);
      });
    }
    return node;
  }

  const topLevelKeys = Object.keys(xmlRoot || {});
  const preferredTop =
    topLevelKeys.includes('everything') ? 'everything' : topLevelKeys[0] || 'root';
  const topValue = xmlRoot?.[preferredTop];

  const rootChildren = nodesFromKeyAndValue(preferredTop, topValue);

  return {
    id: makeId(),
    name: preferredTop,
    tag: preferredTop,
    xmlId: null,
    attrs: {},
    children: rootChildren.length ? rootChildren : [],
  };
}

// Build hierarchy starting from a specific element entry (e.g., one Artboard)
function buildHierarchyFromEntry(tagName, elementObj) {
  let nextId = 1;
  const makeId = () => `n${nextId++}`;

  const isXmlElement = (val) =>
    !!val && typeof val === 'object' && !Array.isArray(val);

  function shouldSkipKey(keyLower) {
    if (keyLower === 'statemachine' || keyLower.includes('keyframe')) {
      return true;
    }
    // Exclude all animation nodes and their children
    if (keyLower.includes('animation')) {
      return true;
    }
    const hasConstraint = keyLower.includes('constraint');
    const hasBind =
      keyLower.includes('databind') ||
      keyLower.includes('data_bind') ||
      keyLower.includes('binding') ||
      keyLower.includes('bind');
    if (hasConstraint && hasBind) {
      return true;
    }
    return false;
  }

  function nodesFromKeyAndValue(key, value) {
    const keyLower = String(key).toLowerCase();
    // Disregard StateMachine, keyframes, and data-bind constraints
    if (shouldSkipKey(keyLower)) {
      return [];
    }
    if (Array.isArray(value)) {
      return value
        .filter((el) => isXmlElement(el))
        .map((el, idx) => nodeFromEntry(key, el, idx));
    }
    if (isXmlElement(value)) {
      return [nodeFromEntry(key, value)];
    }
    return [];
  }

  function nodeFromEntry(tag, element, idx) {
    const tagLower = String(tag).toLowerCase();
    const nameAttr =
      element?._attributes?.name ??
      element?._attributes?.id ??
      (typeof idx === 'number' ? `${tag}[${idx}]` : tag);
    const node = {
      id: makeId(),
      name: `${tag}${nameAttr ? `: ${nameAttr}` : ''}`,
      tag: String(tag),
      xmlId: element?._attributes?.id ?? null,
      attrs: element?._attributes ?? {},
      children: [],
    };
    // Do not recurse into Shape nodes (skip PointsPath/Fill/Stroke etc)
    if (tagLower !== 'shape') {
      Object.keys(element || {}).forEach((childKey) => {
        if (childKey === '_attributes' || childKey === '_text' || childKey === '_cdata') {
          return;
        }
        const childVal = element[childKey];
        const childNodes = nodesFromKeyAndValue(childKey, childVal);
        node.children.push(...childNodes);
      });
    }
    return node;
  }

  return nodeFromEntry(tagName, elementObj);
}

function layoutTree(root, config = {}) {
  const levelHeight = config.levelHeight ?? 80;
  const nodeSpacingX = config.nodeSpacingX ?? 3;
  const margins = config.margins ?? { top: 20, right: 20, bottom: 20, left: 20 };

  let maxDepth = 0;

  function assign(node, depth, xStartUnit) {
    maxDepth = Math.max(maxDepth, depth);
    if (!node.children || node.children.length === 0) {
      node._xUnit = xStartUnit + 0.5;
      node._yDepth = depth;
      return 1;
    }
    let curr = xStartUnit;
    const centers = [];
    let totalWidth = 0;
    for (const child of node.children) {
      const w = assign(child, depth + 1, curr);
      centers.push(child._xUnit);
      curr += w;
      totalWidth += w;
    }
    const avgCenter =
      centers.reduce((sum, c) => sum + c, 0) / (centers.length || 1);
    node._xUnit = avgCenter;
    node._yDepth = depth;
    return Math.max(1, totalWidth);
  }

  const totalUnits = assign(root, 0, 0);

  function applyPixels(node) {
    node.x = margins.left + node._xUnit * nodeSpacingX;
    node.y = margins.top + node._yDepth * levelHeight;
    (node.children || []).forEach(applyPixels);
  }
  applyPixels(root);

  const width = margins.left + totalUnits * nodeSpacingX + margins.right;
  const height = margins.top + (maxDepth + 1) * levelHeight + margins.bottom;

  return { width, height, root };
}

// Radial tree layout: assign angle and radius, convert to x,y around center
function layoutRadialTree(root, config = {}) {
  const levelRadius = config.levelRadius ?? 90;
  const innerRadius = config.innerRadius ?? 40;
  const angleStart = config.angleStart ?? -Math.PI / 2; // 12 o'clock
  const angleSpan = config.angleSpan ?? Math.PI * 2; // full circle
  const outerPadding = config.outerPadding ?? 40;
  const minSpacing = config.minSpacing ?? 18; // minimum chord distance between neighbors on same ring (px)

  let maxDepth = 0;

  function assign(node, depth, xStartUnit) {
    maxDepth = Math.max(maxDepth, depth);
    if (!node.children || node.children.length === 0) {
      node._unit = xStartUnit + 0.5;
      node._depth = depth;
      return 1;
    }
    let curr = xStartUnit;
    const centers = [];
    let totalWidth = 0;
    for (const child of node.children) {
      const w = assign(child, depth + 1, curr);
      centers.push(child._unit);
      curr += w;
      totalWidth += w;
    }
    const avgCenter = centers.reduce((s, c) => s + c, 0) / (centers.length || 1);
    node._unit = avgCenter;
    node._depth = depth;
    return Math.max(1, totalWidth);
  }

  const totalUnits = assign(root, 0, 0);

  const radiusMax = innerRadius + maxDepth * levelRadius;
  const size = radiusMax * 2 + outerPadding * 2;
  const cx = size / 2;
  const cy = size / 2;

  function unitToAngle(unit) {
    return angleStart + (unit / totalUnits) * angleSpan;
  }

  function applyPolar(node) {
    node.angle = unitToAngle(node._unit);
    node.r = innerRadius + node._depth * levelRadius;
    node.x = cx + Math.cos(node.angle) * node.r;
    node.y = cy + Math.sin(node.angle) * node.r;
    (node.children || []).forEach(applyPolar);
  }
  applyPolar(root);

  // Procedural spacing per depth ring to enforce minimum chord spacing
  const depthMap = new Map();
  (function collectByDepth(node) {
    if (!depthMap.has(node._depth)) depthMap.set(node._depth, []);
    depthMap.get(node._depth).push(node);
    (node.children || []).forEach(collectByDepth);
  })(root);

  for (const [depth, nodes] of depthMap.entries()) {
    if (nodes.length <= 1) {
      // Still ensure r reflects default
      const rDefault = innerRadius + depth * levelRadius;
      for (const n of nodes) {
        n.r = rDefault;
        n.x = cx + Math.cos(n.angle) * n.r;
        n.y = cy + Math.sin(n.angle) * n.r;
      }
      continue;
    }
    // Ensure ring radius can accommodate min spacing: m * (s / r) <= 2π => r >= s*m/(2π)
    const m = nodes.length;
    const rDefault = innerRadius + depth * levelRadius;
    const rMin = (minSpacing * m) / (2 * Math.PI);
    const ringR = Math.max(rDefault, rMin);
    const minDelta = minSpacing / ringR;

    // Sort by current angle
    const sorted = [...nodes].sort((a, b) => a.angle - b.angle);
    // Greedy forward pass to enforce min gaps
    const base = sorted[0].angle;
    const newAngles = new Array(m);
    newAngles[0] = base;
    for (let i = 1; i < m; i++) {
      const want = newAngles[i - 1] + minDelta;
      newAngles[i] = Math.max(sorted[i].angle, want);
    }
    // Wrap-around check
    const wrapNeeded = newAngles[m - 1] + minDelta - (base + 2 * Math.PI);
    if (wrapNeeded > 0) {
      // If greedy overflows, fall back to equal spacing while preserving rotation around mean angle
      const mean =
        sorted.reduce((s, n) => s + n.angle, 0) / m;
      const start = mean - Math.PI; // center the band roughly
      const step = (2 * Math.PI) / m;
      for (let i = 0; i < m; i++) {
        newAngles[i] = start + i * step;
      }
    }
    // Apply angles and updated radius
    for (let i = 0; i < m; i++) {
      const n = sorted[i];
      n.angle = newAngles[i];
      n.r = ringR;
      n.x = cx + Math.cos(n.angle) * n.r;
      n.y = cy + Math.sin(n.angle) * n.r;
    }
  }

  return { width: size, height: size, root, cx, cy };
}

// Compact BFS layout: place nodes incrementally with minimum padding, no strict rings.
function layoutCompactBFS(root, config = {}) {
  const padding = config.padding ?? 18; // min distance between nodes
  const baseChildDist = config.baseChildDist ?? 38; // preferred parent->child distance
  const radiusStep = config.radiusStep ?? 14; // how much to expand when space is tight
  const angleStepDeg = config.angleStepDeg ?? 14; // angular sampling step around parent
  const margins = config.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };

  const angleStep = (angleStepDeg * Math.PI) / 180;

  // Spatial hash to accelerate neighbor checks
  const cell = Math.max(8, padding);
  const grid = new Map();
  const keyOf = (x, y) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
  const addToGrid = (n) => {
    const k = keyOf(n.x, n.y);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(n);
  };
  const nearCells = (x, y) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const res = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const k = `${gx + dx}:${gy + dy}`;
        const arr = grid.get(k);
        if (arr) res.push(...arr);
      }
    }
    return res;
  };
  const hasClearance = (x, y) => {
    const neighbors = nearCells(x, y);
    for (const other of neighbors) {
      const dx = x - other.x;
      const dy = y - other.y;
      if (dx * dx + dy * dy < padding * padding) {
        return false;
      }
    }
    return true;
  };

  // Place root at origin
  root.x = 0;
  root.y = 0;
  addToGrid(root);

  // BFS queue
  const queue = [root];

  // Track bounds
  let minX = root.x;
  let maxX = root.x;
  let minY = root.y;
  let maxY = root.y;

  // Helper to clamp angle to [-π, π]
  const normAngle = (a) => {
    let t = a;
    while (t <= -Math.PI) t += 2 * Math.PI;
    while (t > Math.PI) t -= 2 * Math.PI;
    return t;
  };

  // Store and reuse a suggested direction per node (from its parent)
  // Default direction for root is -90deg (up)
  const dirMap = new Map();
  dirMap.set(root, -Math.PI / 2);

  while (queue.length) {
    const parent = queue.shift();
    const parentDir = dirMap.get(parent) ?? -Math.PI / 2;

    const children = parent.children || [];
    // Interleave angles around parentDir to pack siblings close together
    const angleOffsets = [];
    const maxSamples = Math.max(1, Math.ceil(Math.PI / angleStep));
    for (let i = 0; i <= maxSamples; i++) {
      const off = i * angleStep;
      if (off !== 0) angleOffsets.push(off, -off);
      else angleOffsets.push(0);
    }

    for (let idx = 0; idx < children.length; idx++) {
      const child = children[idx];

      let placed = false;
      // Try growing rings around the parent to find the first valid slot
      for (let ring = 0; ring < 24 && !placed; ring++) {
        const r = baseChildDist + ring * radiusStep;
        for (let k = 0; k < angleOffsets.length && !placed; k++) {
          const theta = normAngle(parentDir + angleOffsets[k]);
          const cx = parent.x + Math.cos(theta) * r;
          const cy = parent.y + Math.sin(theta) * r;
          if (hasClearance(cx, cy)) {
            child.x = cx;
            child.y = cy;
            addToGrid(child);
            // Direction for this child will point outward from the parent
            dirMap.set(child, theta);
            placed = true;
            minX = Math.min(minX, cx);
            maxX = Math.max(maxX, cx);
            minY = Math.min(minY, cy);
            maxY = Math.max(maxY, cy);
            break;
          }
        }
      }
      // Fallback: place very near parent with small jitter if we somehow didn't find a slot
      if (!placed) {
        const theta = normAngle(parentDir + (idx % 2 === 0 ? 0.2 : -0.2));
        const r = baseChildDist * 0.8;
        const cx = parent.x + Math.cos(theta) * r;
        const cy = parent.y + Math.sin(theta) * r;
        child.x = cx;
        child.y = cy;
        addToGrid(child);
        dirMap.set(child, theta);
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
      }

      queue.push(child);
    }
  }

  // Translate all coords to positive space with margins
  const width = (maxX - minX) + margins.left + margins.right;
  const height = (maxY - minY) + margins.top + margins.bottom;
  const offsetX = margins.left - minX;
  const offsetY = margins.top - minY;
  (function applyOffset(node) {
    node.x += offsetX;
    node.y += offsetY;
    (node.children || []).forEach(applyOffset);
  })(root);

  return { width, height, root, cx: width / 2, cy: height / 2 };
}

function flattenNodes(node, arr = []) {
  arr.push(node);
  for (const child of node.children || []) {
    flattenNodes(child, arr);
  }
  return arr;
}

function collectLinks(node, links = []) {
  for (const child of node.children || []) {
    links.push({ source: node, target: child });
    collectLinks(child, links);
  }
  return links;
}

// Find constraint arrows: nodes with tag including 'constraint' and a target attribute
function collectConstraintArrows(root) {
  const all = flattenNodes(root);
  const idToNode = new Map();
  for (const n of all) {
    if (n.xmlId) idToNode.set(String(n.xmlId), n);
  }
  const arrows = [];
  for (const n of all) {
    const tagLower = String(n.tag || '').toLowerCase();
    if (!tagLower.includes('constraint')) continue;
    const attrs = n.attrs || {};
    // Look for any attribute with 'target' in its name
    const keys = Object.keys(attrs || {});
    let targetVal = null;
    for (const k of keys) {
      if (k.toLowerCase().includes('target')) {
        targetVal = attrs[k];
        if (typeof targetVal !== 'undefined') break;
      }
    }
    if (!targetVal) continue;
    const targetNode = idToNode.get(String(targetVal));
    if (targetNode) {
      arrows.push({ source: n, target: targetNode });
    }
  }
  return arrows;
}

// Assign a hue to each node based on its angle in a radial layout (stable color across views)
function assignHueFromRadial(root) {
  // Run radial layout to compute angles (mutates nodes' angle/x/y temporarily)
  layoutRadialTree(root);
  const all = flattenNodes(root);
  for (const n of all) {
    const a = typeof n.angle === 'number' ? n.angle : 0;
    // Normalize angle to [0, 360)
    const twoPi = Math.PI * 2;
    const norm = ((a % twoPi) + twoPi) % twoPi;
    const hue = Math.round((norm / twoPi) * 360);
    n.hue = hue;
  }
  return root;
}


function SvgTreeCompact({ hierarchy, showConstraints }) {
  // Incremental compact BFS with parent wedge constraint
  // Concentric rings by depth, with parent wedge and chunked placement
  const minChord = 18;            // minimum chord spacing on a ring (px)
  const innerRadius = 40;         // radius for depth 1 (root at 0)
  const levelRadius = 60;         // radius added per depth level
  const radiusStep = 12;          // small outward push when crowded
  const angleStepDeg = 8;         // sampling step within wedge
  const wedgePerChildDeg = 10;    // wedge width scales with number of siblings
  const minWedgeDeg = 20;
  const maxWedgeDeg = 120;
  const margins = { top: 40, right: 40, bottom: 40, left: 40 };

  const svgRef = React.useRef(null);
  const engineRef = React.useRef(null);
  const linksRef = React.useRef(null);
  const [placedTick, setPlacedTick] = React.useState(0);
  const [bounds, setBounds] = React.useState({
    minX: 0, minY: 0, maxX: 1, maxY: 1,
  });

  // Build links once
  React.useEffect(() => {
    linksRef.current = collectLinks(hierarchy);
  }, [hierarchy]);

  // Initialize engine when hierarchy changes (ring-based BFS)
  React.useEffect(() => {
    const normAngle = (a) => {
      let t = a;
      while (t <= -Math.PI) t += 2 * Math.PI;
      while (t > Math.PI) t -= 2 * Math.PI;
      return t;
    };

    // Reset placement flags
    (function reset(node) {
      delete node.x; delete node.y; delete node._nextChildIdx; delete node.angle; delete node.d;
      (node.children || []).forEach(reset);
    })(hierarchy);

    // Place root at the center
    hierarchy.x = 0; hierarchy.y = 0; hierarchy._nextChildIdx = 0; hierarchy.d = 0;
    const queue = [hierarchy];

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    const angleStep = (angleStepDeg * Math.PI) / 180;

    // Track occupied angles per depth ring
    const ringAngles = new Map(); // depth -> sorted array of angles (-PI..PI)
    const getRing = (depth) => {
      let arr = ringAngles.get(depth);
      if (!arr) { arr = []; ringAngles.set(depth, arr); }
      return arr;
    };
    const insertAngle = (arr, angle) => {
      let lo = 0, hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < angle) lo = mid + 1; else hi = mid;
      }
      arr.splice(lo, 0, angle);
    };
    const canPlaceOnRing = (arr, angle, minDelta) => {
      if (arr.length === 0) return true;
      let lo = 0, hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < angle) lo = mid + 1; else hi = mid;
      }
      const prev = arr[(lo - 1 + arr.length) % arr.length];
      const next = arr[lo % arr.length];
      const deltaPrev = Math.abs(normAngle(angle - prev));
      const deltaNext = Math.abs(normAngle(next - angle));
      return deltaPrev >= minDelta && deltaNext >= minDelta;
    };
    const parentAngle = (n) => {
      if (typeof n.angle === 'number') return n.angle;
      if (n.x === 0 && n.y === 0) return -Math.PI / 2;
      return Math.atan2(n.y, n.x);
    };

    function placeNext(limit) {
      let placed = 0;
      while (placed < limit && queue.length) {
        const parent = queue[0];
        const parentDir = parentAngle(parent);
        const children = parent.children || [];
        if (!children.length || parent._nextChildIdx >= children.length) {
          // parent done
          queue.shift();
          continue;
        }
        const child = children[parent._nextChildIdx++];
        // Target ring radius by depth
        const depth = (parent.d || 0) + 1;
        child.d = depth;
        const baseR = innerRadius + (depth - 1) * levelRadius;
        const ringArr = getRing(depth);
        const baseMinDelta = Math.min(Math.PI, (minChord / Math.max(1, baseR)));

        // Constrain search to parent wedge
        const count = children.length || 1;
        const wedgeHalfDeg = Math.min(
          maxWedgeDeg,
          Math.max(minWedgeDeg, (count * wedgePerChildDeg) / 2)
        );
        const wedgeHalf = (wedgeHalfDeg * Math.PI) / 180;
        // Sample offsets within [-wedgeHalf, +wedgeHalf], centered at 0, alternating sides
        const angleOffsets = [0];
        for (let a = angleStep; a <= wedgeHalf; a += angleStep) {
          angleOffsets.push(-a, a);
        }

        let placedChild = false;
        for (let grow = 0; grow < 10 && !placedChild; grow++) {
          const r = baseR + grow * radiusStep;
          const minDelta = Math.min(Math.PI, (minChord / Math.max(1, r)));
          for (let k = 0; k < angleOffsets.length && !placedChild; k++) {
            const theta = normAngle(parentDir + angleOffsets[k]);
            if (canPlaceOnRing(ringArr, theta, minDelta)) {
              const cx = Math.cos(theta) * r;
              const cy = Math.sin(theta) * r;
              child.x = cx; child.y = cy; child.angle = theta; child._nextChildIdx = 0;
              insertAngle(ringArr, theta);
              queue.push(child);
              minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
              minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
              placedChild = true;
              placed++;
              break;
            }
          }
        }
        if (!placedChild) {
          // Fallback: place on base ring near parentDir
          const theta = normAngle(parentDir + (parent._nextChildIdx % 2 === 0 ? 0.2 : -0.2));
          const r = baseR;
          const cx = Math.cos(theta) * r;
          const cy = Math.sin(theta) * r;
          child.x = cx; child.y = cy; child.angle = theta; child._nextChildIdx = 0;
          insertAngle(ringArr, theta);
          queue.push(child);
          minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
          placed++;
        }
      }
      // Update bounds state after this chunk
      setBounds({
        minX, minY, maxX: Math.max(maxX, 1), maxY: Math.max(maxY, 1),
      });
      return queue.length === 0;
    }

    engineRef.current = {
      step: placeNext,
      done: () => (queue.length === 0),
    };
    setPlacedTick((t) => t + 1); // trigger paint with root
  }, [hierarchy]);

  // Drive incremental layout
  React.useEffect(() => {
    let rafId = 0;
    const totalNodes = flattenNodes(hierarchy).length;
    const budget =
      totalNodes < 500 ? 400 :
      totalNodes < 2000 ? 1200 : 2500; // nodes per frame
    const loop = () => {
      const engine = engineRef.current;
      if (!engine) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      const done = engine.step(budget);
      setPlacedTick((t) => t + 1);
      if (!done) {
        rafId = requestAnimationFrame(loop);
      }
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [hierarchy]);

  // Pan & zoom using viewBox (do not reset on size changes to avoid snapping)
  const [viewBox, setViewBox] = React.useState(() => ({
    x: -200, y: -200, w: 400, h: 400,
  }));
  React.useEffect(() => {
    // Reset only when hierarchy changes
    const w = Math.max(200, bounds.maxX - bounds.minX + margins.left + margins.right);
    const h = Math.max(200, bounds.maxY - bounds.minY + margins.top + margins.bottom);
    setViewBox({
      x: bounds.minX - margins.left,
      y: bounds.minY - margins.top,
      w, h,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchy]);

  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef({ x: 0, y: 0 });
  const onWheel = React.useCallback((e) => {
    if (!svgRef.current) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zx = mx / rect.width;
    const zy = my / rect.height;
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    const aspect = viewBox.w / viewBox.h || 1;
    const minW = 50;
    const maxW = Math.max(400, (bounds.maxX - bounds.minX) + margins.left + margins.right);
    const newW = Math.min(maxW, Math.max(minW, viewBox.w * factor));
    const newH = newW / aspect;
    const newX = viewBox.x + (viewBox.w - newW) * zx;
    const newY = viewBox.y + (viewBox.h - newH) * zy;
    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  }, [viewBox, bounds]);
  const onMouseDown = React.useCallback((e) => {
    if (!svgRef.current) return;
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = React.useCallback((e) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dxPx = e.clientX - dragRef.current.x;
    const dyPx = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    const dx = -dxPx * (viewBox.w / rect.width);
    const dy = -dyPx * (viewBox.h / rect.height);
    setViewBox((vb) => ({ ...vb, x: vb.x + dx, y: vb.y + dy }));
  }, [dragging, viewBox.w, viewBox.h]);
  const endDrag = React.useCallback(() => setDragging(false), []);

  // Collect placed nodes and drawable links
  const allNodes = React.useMemo(() => flattenNodes(hierarchy), [hierarchy, placedTick]);
  const placedNodes = allNodes.filter((n) => typeof n.x === 'number' && typeof n.y === 'number');
  const links = (linksRef.current || []).filter(
    (l) => typeof l.source?.x === 'number' && typeof l.source?.y === 'number' &&
           typeof l.target?.x === 'number' && typeof l.target?.y === 'number'
  );
  const constraintArrows = React.useMemo(() => {
    const arrows = collectConstraintArrows(hierarchy);
    return arrows.filter(
      (l) =>
        typeof l.source?.x === 'number' &&
        typeof l.source?.y === 'number' &&
        typeof l.target?.x === 'number' &&
        typeof l.target?.y === 'number'
    );
  }, [hierarchy, placedTick]);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 0 }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{ background: '#fff', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#A0AEC0" />
          </marker>
        </defs>
        {links.map((l, i) => (
          <line
            key={`link-${i}`}
            x1={l.source.x}
            y1={l.source.y}
            x2={l.target.x}
            y2={l.target.y}
            stroke="#A0AEC0"
            strokeWidth="1.25"
            markerEnd="url(#arrow)"
          />
        ))}
        {showConstraints &&
          constraintArrows.map((l, i) => (
            <line
              key={`cl-${i}`}
              x1={l.source.x}
              y1={l.source.y}
              x2={l.target.x}
              y2={l.target.y}
              stroke="#E53E3E"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
              opacity="0.9"
            />
          ))}
        {placedNodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
            <circle r="10" fill="#3182CE" stroke="#1A365D" strokeWidth="1" />
            <text
              x={12}
              y="4"
              textAnchor="start"
              fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
              fontSize="12"
              fill="#1A202C"
            >
              {n.name}
            </text>
            <title>{n.name}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SvgTreeStatic({ hierarchy, type, showConstraints, showLabels, enableForces = false, linkStrength = 0.02, repelStrength = 1000, linkLength = 100, resetCounter = 0 }) {
  // Compute layout
  let layout;
  if (type === 'radial') {
    layout = layoutRadialTree(hierarchy);
  } else {
    layout = layoutTree(hierarchy);
  }
  const { width, height, root, cx, cy } = layout;
  const nodes = flattenNodes(root);
  const links = collectLinks(root);
  const constraintArrows = collectConstraintArrows(root);

  // Pan & zoom using viewBox
  const svgRef = React.useRef(null);
  const [viewBox, setViewBox] = React.useState(() => ({
    x: 0, y: 0, w: Math.max(1, width), h: Math.max(1, height),
  }));
  React.useEffect(() => {
    setViewBox({ x: 0, y: 0, w: Math.max(1, width), h: Math.max(1, height) });
  }, [width, height, hierarchy?.id, type]);

  // Node drag overrides
  const [nodeOverrides, setNodeOverrides] = React.useState({});
  const [nodeDraggingId, setNodeDraggingId] = React.useState(null);
  const nodeDragRef = React.useRef({ id: null, ox: 0, oy: 0 });
  const nodeDraggingIdRef = React.useRef(null);
  React.useEffect(() => {
    nodeDraggingIdRef.current = nodeDraggingId;
  }, [nodeDraggingId]);
  const overridesRef = React.useRef(nodeOverrides);
  React.useEffect(() => {
    overridesRef.current = nodeOverrides;
  }, [nodeOverrides]);
  const getPos = React.useCallback(
    (n) => {
      const ov = nodeOverrides[n.id];
      return { x: (ov?.x ?? n.x), y: (ov?.y ?? n.y) };
    },
    [nodeOverrides]
  );

  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef({ x: 0, y: 0 });
  const simRef = React.useRef(null); // id -> {x,y,vx,vy}
  const [simTick, setSimTick] = React.useState(0);
  const onWheel = React.useCallback((e) => {
    if (!svgRef.current) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zx = mx / rect.width;
    const zy = my / rect.height;
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    const aspect = viewBox.w / viewBox.h || 1;
    const minW = Math.max(50, width / 50);
    const maxW = width;
    const newW = Math.min(maxW, Math.max(minW, viewBox.w * factor));
    const newH = newW / aspect;
    const newX = viewBox.x + (viewBox.w - newW) * zx;
    const newY = viewBox.y + (viewBox.h - newH) * zy;
    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  }, [viewBox, width]);
  const onMouseDown = React.useCallback((e) => {
    if (!svgRef.current) return;
    if (nodeDraggingId) return;
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }, [nodeDraggingId]);
  const onMouseMove = React.useCallback((e) => {
    if (!svgRef.current) return;
    // Node drag has priority
    if (nodeDraggingId) {
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const svgX = viewBox.x + (mx / rect.width) * viewBox.w;
      const svgY = viewBox.y + (my / rect.height) * viewBox.h;
      const { id, ox, oy } = nodeDragRef.current;
      if (id) {
        const nx = svgX + ox;
        const ny = svgY + oy;
        setNodeOverrides((prev) => ({ ...prev, [id]: { x: nx, y: ny } }));
      }
      return;
    }
    if (!dragging) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dxPx = e.clientX - dragRef.current.x;
    const dyPx = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    const dx = -dxPx * (viewBox.w / rect.width);
    const dy = -dyPx * (viewBox.h / rect.height);
    setViewBox((vb) => ({ ...vb, x: vb.x + dx, y: vb.y + dy }));
  }, [dragging, nodeDraggingId, viewBox.x, viewBox.y, viewBox.w, viewBox.h]);
  const endDrag = React.useCallback(() => {
    setDragging(false);
    setNodeDraggingId(null);
    nodeDragRef.current = { id: null, ox: 0, oy: 0 };
  }, []);

  // Reset to original layout on resetCounter change
  React.useEffect(() => {
    setNodeOverrides({});
    nodeDragRef.current = { id: null, ox: 0, oy: 0 };
    simRef.current = null;
  }, [resetCounter]);

  // Initialize simulation state when enabling forces
  React.useEffect(() => {
    if (!enableForces) {
      simRef.current = null;
      return;
    }
    const map = new Map();
    for (const n of nodes) {
      const p = getPos(n);
      map.set(n.id, { x: p.x, y: p.y, vx: 0, vy: 0 });
    }
    simRef.current = map;
  }, [enableForces, nodes]);

  // Force loop for static layouts (optional)
  React.useEffect(() => {
    if (!enableForces) return;
    let rafId = 0;
    const repelRadius = 180;
    const kLink = linkStrength;
    const kRepel = repelStrength;
    const effectiveLinkLen = linkLength;
    const damping = 0.92;
    const dt = 0.016;
    const stepsPerFrame = 2;
    const frameRef = { current: 0 };

    function stepOnce() {
      const sim = simRef.current;
      if (!sim) return;
      // Build grid
      const cell = Math.max(8, Math.floor(repelRadius));
      const grid = new Map();
      const keyOf = (x, y) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
      for (const n of nodes) {
        const s = sim.get(n.id);
        if (!s) continue;
        const k = keyOf(s.x, s.y);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push({ id: n.id, s });
      }
      const neighborsOf = (x, y) => {
        const gx = Math.floor(x / cell);
        const gy = Math.floor(y / cell);
        const res = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const k = `${gx + dx}:${gy + dy}`;
            const arr = grid.get(k);
            if (arr) res.push(...arr);
          }
        }
        return res;
      };
      // Springs
      for (const l of links) {
        const a = sim.get(l.source.id);
        const b = sim.get(l.target.id);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const nx = dx / dist;
        const ny = dy / dist;
        const delta = dist - effectiveLinkLen;
        const f = kLink * delta * dt;
        const fx = nx * f;
        const fy = ny * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // Repel
      for (const n of nodes) {
        const a = sim.get(n.id);
        if (!a) continue;
        const neigh = neighborsOf(a.x, a.y);
        for (const item of neigh) {
          if (item.id === n.id) continue;
          const b = item.s;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist2 = dx * dx + dy * dy || 1e-6;
          if (dist2 > repelRadius * repelRadius) continue;
          const dist = Math.sqrt(dist2);
          const nx = dx / dist;
          const ny = dy / dist;
          const f = (kRepel / dist2);
          a.vx += nx * f * dt;
          a.vy += ny * f * dt;
        }
      }
      // If dragging a node, pin it to cursor override
      const draggingId = nodeDraggingIdRef.current;
      if (draggingId) {
        const ov = overridesRef.current[draggingId];
        const s = sim.get(draggingId);
        if (ov && s) {
          s.x = ov.x; s.y = ov.y; s.vx = 0; s.vy = 0;
        }
      }
      // Integrate and write back to overrides
      const newOverrides = {};
      for (const n of nodes) {
        const s = sim.get(n.id);
        if (!s) continue;
        s.vx = (s.vx) * damping;
        s.vy = (s.vy) * damping;
        s.x += s.vx;
        s.y += s.vy;
        newOverrides[n.id] = { x: s.x, y: s.y };
      }
      overridesRef.current = newOverrides;
      frameRef.current += 1;
      if (frameRef.current % 3 === 0) {
        setNodeOverrides(overridesRef.current);
      }
    }
    const loop = () => {
      for (let i = 0; i < stepsPerFrame; i++) stepOnce();
      // No need to force re-render every frame; nodeOverrides throttles updates
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [enableForces, nodes, links, type, linkStrength, repelStrength]);

  const controlPoint = (angle, r) => ({
    x: (cx ?? 0) + Math.cos(angle) * r,
    y: (cy ?? 0) + Math.sin(angle) * r,
  });

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 0 }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{ background: '#fff', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#A0AEC0" />
          </marker>
        </defs>
        {links.map((l, i) => {
          const p1 = getPos(l.source);
          const p2 = getPos(l.target);
          return (
            <line
              key={`link-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#A0AEC0"
              strokeWidth="1.25"
              markerEnd="url(#arrow)"
            />
          );
        })}
        {showConstraints &&
          constraintArrows.map((l, i) => (
            <line
              key={`cl-${i}`}
              x1={getPos(l.source).x}
              y1={getPos(l.source).y}
              x2={getPos(l.target).x}
              y2={getPos(l.target).y}
              stroke="#E53E3E"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
              opacity="0.9"
            />
          ))}
        {nodes.map((n) => {
          let anchor = 'start';
          let dx = 12;
          if (type === 'radial') {
            const isRight = Math.cos(n.angle ?? 0) >= 0;
            anchor = isRight ? 'start' : 'end';
            dx = isRight ? 12 : -12;
          }
          const pos = getPos(n);
          return (
            <g
              key={n.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onMouseDown={(e) => {
                if (!svgRef.current) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = svgRef.current.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                const svgX = viewBox.x + (mx / rect.width) * viewBox.w;
                const svgY = viewBox.y + (my / rect.height) * viewBox.h;
                nodeDragRef.current = { id: n.id, ox: pos.x - svgX, oy: pos.y - svgY };
                setNodeDraggingId(n.id);
              }}
              style={{ cursor: 'grab' }}
            >
              <circle
                r="10"
                fill={`hsl(${n.hue ?? 210}, 65%, 55%)`}
                stroke="#1A365D"
                strokeWidth="1"
              />
              {showLabels && (
                <text
                  x={dx}
                  y="4"
                  textAnchor={anchor}
                  fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
                  fontSize="12"
                  fill="#1A202C"
                >
                  {n.name}
                </text>
              )}
              <title>{n.name}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SvgTreeForce({ hierarchy, showConstraints, linkStrength = 0.02, repelStrength = 1000, linkLength = 100, showLabels, resetCounter = 0 }) {
  // Seed from a quick vertical layout for stable starting positions
  const seeded = React.useMemo(() => layoutTree(hierarchy), [hierarchy, resetCounter]);
  const { width, height, root } = seeded;
  const nodes = React.useMemo(() => flattenNodes(root), [root]);
  const links = React.useMemo(() => collectLinks(root), [root]);

  // Simulation state on the nodes themselves
  React.useEffect(() => {
    for (const n of nodes) {
      n.posX = typeof n.x === 'number' ? n.x : 0;
      n.posY = typeof n.y === 'number' ? n.y : 0;
      n.vx = 0;
      n.vy = 0;
    }
  }, [nodes, resetCounter]);

  // Pan & zoom using viewBox
  const svgRef = React.useRef(null);
  const [viewBox, setViewBox] = React.useState(() => ({
    x: 0, y: 0, w: Math.max(1, width), h: Math.max(1, height),
  }));
  React.useEffect(() => {
    setViewBox({ x: 0, y: 0, w: Math.max(1, width), h: Math.max(1, height) });
  }, [width, height, hierarchy?.id]);

  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef({ x: 0, y: 0 });
  const [nodeDraggingId, setNodeDraggingId] = React.useState(null);
  const nodeDragRef = React.useRef({ id: null, ox: 0, oy: 0 });
  const onWheel = React.useCallback((e) => {
    if (!svgRef.current) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zx = mx / rect.width;
    const zy = my / rect.height;
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    const aspect = viewBox.w / viewBox.h || 1;
    const minW = Math.max(50, width / 50);
    const maxW = Math.max(width, 400);
    const newW = Math.min(maxW, Math.max(minW, viewBox.w * factor));
    const newH = newW / aspect;
    const newX = viewBox.x + (viewBox.w - newW) * zx;
    const newY = viewBox.y + (viewBox.h - newH) * zy;
    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  }, [viewBox, width]);
  const onMouseDown = React.useCallback((e) => {
    if (!svgRef.current) return;
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = React.useCallback((e) => {
    if (!svgRef.current) return;
    // Node drag has priority over panning
    if (nodeDraggingId) {
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const svgX = viewBox.x + (mx / rect.width) * viewBox.w;
      const svgY = viewBox.y + (my / rect.height) * viewBox.h;
      const { id, ox, oy } = nodeDragRef.current;
      if (id) {
        const nx = svgX + ox;
        const ny = svgY + oy;
        // Mutate the node directly
        const n = nodes.find((x) => x.id === id);
        if (n) {
          n.posX = nx;
          n.posY = ny;
          n.vx = 0;
          n.vy = 0;
        }
      }
      return;
    }
    if (!dragging) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dxPx = e.clientX - dragRef.current.x;
    const dyPx = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    const dx = -dxPx * (viewBox.w / rect.width);
    const dy = -dyPx * (viewBox.h / rect.height);
    setViewBox((vb) => ({ ...vb, x: vb.x + dx, y: vb.y + dy }));
  }, [dragging, nodeDraggingId, viewBox.x, viewBox.y, viewBox.w, viewBox.h, nodes]);
  const endDrag = React.useCallback(() => {
    setDragging(false);
    setNodeDraggingId(null);
    nodeDragRef.current = { id: null, ox: 0, oy: 0 };
  }, []);

  // Force simulation (chunked per frame)
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let rafId = 0;
    let alpha = 1.0;
    const centerX = width / 2;
    const centerY = height / 2;
    const kLink = linkStrength;
    const kCenter = 0.002;
    const repelRadius = 220;
    const kRepel = repelStrength;
    const damping = 0.9;
    const stepsPerFrame = 2;

    function stepOnce() {
      // Spatial grid for repulsion
      const cell = Math.max(8, Math.floor(repelRadius));
      const grid = new Map();
      const keyOf = (x, y) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
      for (const n of nodes) {
        const k = keyOf(n.posX, n.posY);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(n);
      }
      const neighborsOf = (x, y) => {
        const gx = Math.floor(x / cell);
        const gy = Math.floor(y / cell);
        const res = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const k = `${gx + dx}:${gy + dy}`;
            const arr = grid.get(k);
            if (arr) res.push(...arr);
          }
        }
        return res;
      };

      // Reset velocity incrementally by forces
      // Centering
      // for (const n of nodes) {
      //   const fx = (centerX - n.posX) * kCenter;
      //   const fy = (centerY - n.posY) * kCenter;
      //   n.vx += fx;
      //   n.vy += fy;
      // }
      // Springs
      
      for (const l of links) {
        const s = l.source;
        const t = l.target;
        const dx = t.posX - s.posX;
        const dy = t.posY - s.posY;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const nx = dx / dist;
        const ny = dy / dist;
        const delta = dist - linkLength;
        const f = kLink * delta * alpha;
        const fx = nx * f;
        const fy = ny * f;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }
      // Repulsion (local via grid)
      for (const n of nodes) {
        const neigh = neighborsOf(n.posX, n.posY);
        for (const m of neigh) {
          if (m === n) continue;
          const dx = n.posX - m.posX;
          const dy = n.posY - m.posY;
          const dist2 = dx * dx + dy * dy || 1e-6;
          if (dist2 > repelRadius * repelRadius) continue;
          const dist = Math.sqrt(dist2);
          const nx = dx / dist;
          const ny = dy / dist;
          const f = (kRepel / dist2) * alpha;
          n.vx += nx * f;
          n.vy += ny * f;
        }
      }
      // Integrate
      for (const n of nodes) {
        n.vx *= damping;
        n.vy *= damping;
        n.posX += n.vx;
        n.posY += n.vy;
      }
      // Cool down
      // alpha *= 0.99;
    }

    const loop = () => {
      for (let i = 0; i < stepsPerFrame; i++) stepOnce();
      setTick((t) => t + 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [nodes, links, width, height, linkStrength, repelStrength]);

  const constraintArrows = React.useMemo(() => collectConstraintArrows(root), [root, tick]);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 0 }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{ background: '#fff', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#A0AEC0" />
          </marker>
        </defs>
        {links.map((l, i) => (
          <line
            key={`fl-${i}`}
            x1={l.source.posX ?? l.source.x}
            y1={l.source.posY ?? l.source.y}
            x2={l.target.posX ?? l.target.x}
            y2={l.target.posY ?? l.target.y}
            stroke="#A0AEC0"
            strokeWidth="1.25"
            markerEnd="url(#arrow)"
          />
        ))}
        {showConstraints &&
          constraintArrows.map((l, i) => (
            <line
              key={`fcl-${i}`}
              x1={l.source.posX ?? l.source.x}
              y1={l.source.posY ?? l.source.y}
              x2={l.target.posX ?? l.target.x}
              y2={l.target.posY ?? l.target.y}
              stroke="#E53E3E"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
              opacity="0.9"
            />
          ))}
        {nodes.map((n) => {
          const px = n.posX ?? n.x;
          const py = n.posY ?? n.y;
          return (
            <g
              key={n.id}
              transform={`translate(${px}, ${py})`}
              onMouseDown={(e) => {
                if (!svgRef.current) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = svgRef.current.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                const svgX = viewBox.x + (mx / rect.width) * viewBox.w;
                const svgY = viewBox.y + (my / rect.height) * viewBox.h;
                const cx = n.posX ?? n.x ?? 0;
                const cy = n.posY ?? n.y ?? 0;
                nodeDragRef.current = { id: n.id, ox: cx - svgX, oy: cy - svgY };
                setNodeDraggingId(n.id);
              }}
              style={{ cursor: 'grab' }}
            >
              <circle
                r="10"
                fill={`hsl(${n.hue ?? 210}, 65%, 55%)`}
                stroke="#1A365D"
                strokeWidth="1"
              />
              {showLabels && (
                <text
                  x={12}
                  y="4"
                  textAnchor="start"
                  fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
                  fontSize="12"
                  fill="#1A202C"
                >
                  {n.name}
                </text>
              )}
              <title>{n.name}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SvgTree({ hierarchy, mode, showConstraints, linkStrength, repelStrength, linkLength, showLabels, staticForcesOn, resetCounter }) {
  if (mode === 'force') {
    return (
      <SvgTreeForce
        hierarchy={hierarchy}
        showConstraints={showConstraints}
        linkStrength={linkStrength}
        repelStrength={repelStrength}
        linkLength={linkLength}
        showLabels={showLabels}
        resetCounter={resetCounter}
      />
    );
  }
  if (mode === 'radial') {
    return <SvgTreeStatic hierarchy={hierarchy} type="radial" showConstraints={showConstraints} showLabels={showLabels} enableForces={staticForcesOn} linkStrength={linkStrength} repelStrength={repelStrength} linkLength={linkLength} resetCounter={resetCounter} />;
  }
  // default to vertical
  return <SvgTreeStatic hierarchy={hierarchy} type="vertical" showConstraints={showConstraints} showLabels={showLabels} enableForces={staticForcesOn} linkStrength={linkStrength} repelStrength={repelStrength} linkLength={linkLength} resetCounter={resetCounter} />;
}
function App() {
  const [xmlData, setXmlData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enablePhysics, setEnablePhysics] = useState(false);
  const [layoutMode, setLayoutMode] = useState('vertical'); // 'vertical' | 'radial' | 'compact'
  const [showConstraints, setShowConstraints] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [forceLinkK, setForceLinkK] = useState(0.02);     // spring strength
  const [forceRepelK, setForceRepelK] = useState(1000);   // repulsion strength
  const [forceLinkLen, setForceLinkLen] = useState(100);  // preferred link length
  const [resetCounter, setResetCounter] = useState(0);
  const [selectedArtboardName, setSelectedArtboardName] = useState(null);
  
  useEffect(() => {
    const url = `${process.env.PUBLIC_URL || ''}/avatar_vis_dev_009.xml`;
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load XML (${response.status} ${response.statusText})`);
        }
        return response.text();
      })
      .then((xmlText) => {
        // Use xml2js to get a JS object directly (faster than xml2json + JSON.parse)
        const objData = xmlJs.xml2js(xmlText, { compact: true });
        setXmlData(objData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching/parsing XML data:', err);
        setError(err.message || String(err));
        setLoading(false);
      });
  }, []);

  const artboardEntries = React.useMemo(() => {
    const arts = xmlData?.everything?.Artboard;
    if (!arts) return [];
    return Array.isArray(arts) ? arts : [arts];
  }, [xmlData]);

  const artboardOptions = React.useMemo(() => {
    return artboardEntries.map((a, idx) => {
      const name = a?._attributes?.name ?? a?._attributes?.id ?? `Artboard[${idx}]`;
      return { name, ref: a };
    });
  }, [artboardEntries]);

  // Initialize selection to preferred or first available
  React.useEffect(() => {
    if (!artboardOptions.length) return;
    const preferred = artboardOptions.find(o => o.name === 'avatar_child_artboard')?.name ?? artboardOptions[0].name;
    setSelectedArtboardName(preferred);
  }, [artboardOptions]);

  const treeFromArtboard = React.useMemo(() => {
    if (!xmlData || !selectedArtboardName) return null;
    const match = artboardEntries.find(
      (a, idx) => {
        const nm = a?._attributes?.name ?? a?._attributes?.id ?? `Artboard[${idx}]`;
        return nm === selectedArtboardName;
      }
    );
    if (match) {
      try {
        return buildHierarchyFromEntry('Artboard', match);
      } catch (e) {
        console.error('Failed to build Artboard hierarchy:', e);
        return null;
      }
    }
    return null;
  }, [xmlData, selectedArtboardName, artboardEntries]);

  const preparedHierarchy = React.useMemo(() => {
    if (!treeFromArtboard) return null;
    try {
      return assignHueFromRadial(treeFromArtboard);
    } catch {
      return treeFromArtboard;
    }
  }, [treeFromArtboard]);

  return (
    <div className="App">
      <header className="App-header" style={{ display: 'none' }} />
      
      <div className="container" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>  
        {loading && <p>Loading XML data...</p>}
        {!loading && error && (
          <p style={{ color: '#E53E3E', fontFamily: 'system-ui, -apple-system' }}>
            Error: {error}
          </p>
        )}
        {!loading && !error && treeFromArtboard && (
          <>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #E2E8F0', background: '#F7FAFC' }}>
              <h3 style={{ margin: 0, fontFamily: 'system-ui, -apple-system', fontWeight: 600 }}>
                Artboard: {selectedArtboardName || '(none)'}
              </h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Select artboard:
                <select
                  value={selectedArtboardName || ''}
                  onChange={(e) => setSelectedArtboardName(e.target.value)}
                  style={{ padding: '2px 6px' }}
                >
                  {artboardOptions.map((opt) => (
                    <option key={opt.name} value={opt.name}>{opt.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Layout:
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value)}
                  style={{ padding: '2px 6px' }}
                >
                  <option value="vertical">Vertical tree</option>
                  <option value="radial">Radial tree</option>
                  <option value="force">Force-directed</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showConstraints}
                  onChange={(e) => setShowConstraints(e.target.checked)}
                />
                Show constraint arrows
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                />
                Show labels
              </label>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SvgTree
                  hierarchy={preparedHierarchy}
                  mode={layoutMode}
                  showConstraints={showConstraints}
                  linkStrength={forceLinkK}
                  repelStrength={forceRepelK}
                  linkLength={forceLinkLen}
                  showLabels={showLabels}
                  resetCounter={resetCounter}
                  staticForcesOn={enablePhysics && (layoutMode === 'vertical' || layoutMode === 'radial')}
                />
              </div>
              <aside style={{ width: 280, borderLeft: '1px solid #E2E8F0', padding: '10px 12px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontWeight: 600, fontFamily: 'system-ui, -apple-system', marginBottom: 4 }}>Forces</div>
                {layoutMode === 'force' && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Link k</span>
                      <input
                        type="range"
                        min={0.005}
                        max={0.1}
                        step={0.005}
                        value={forceLinkK}
                        onChange={(e) => setForceLinkK(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ width: 48, textAlign: 'right' }}>{forceLinkK.toFixed(3)}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Repel k</span>
                      <input
                        type="range"
                        min={100}
                        max={5000}
                        step={100}
                        value={forceRepelK}
                        onChange={(e) => setForceRepelK(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ width: 48, textAlign: 'right' }}>{Math.round(forceRepelK)}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Link length</span>
                      <input
                        type="range"
                        min={40}
                        max={300}
                        step={5}
                        value={forceLinkLen}
                        onChange={(e) => setForceLinkLen(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ width: 48, textAlign: 'right' }}>{Math.round(forceLinkLen)}</span>
                    </label>
                  </>
                )}
                {(layoutMode === 'vertical' || layoutMode === 'radial') && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={enablePhysics}
                        onChange={(e) => setEnablePhysics(e.target.checked)}
                      />
                      Enable forces
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', opacity: enablePhysics ? 1 : 0.5 }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Link k</span>
                      <input
                        type="range"
                        min={0.005}
                        max={0.1}
                        step={0.005}
                        value={forceLinkK}
                        onChange={(e) => setForceLinkK(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                        disabled={!enablePhysics}
                      />
                      <span style={{ width: 48, textAlign: 'right' }}>{forceLinkK.toFixed(3)}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', opacity: enablePhysics ? 1 : 0.5 }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Repel k</span>
                      <input
                        type="range"
                        min={100}
                        max={5000}
                        step={100}
                        value={forceRepelK}
                        onChange={(e) => setForceRepelK(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                        disabled={!enablePhysics}
                      />
                      <span style={{ width: 48, textAlign: 'right' }}>{Math.round(forceRepelK)}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', opacity: enablePhysics ? 1 : 0.5 }}>
                      <span style={{ whiteSpace: 'nowrap' }}>Link length</span>
                      <input
                        type="range"
                        min={40}
                        max={300}
                        step={5}
                        value={forceLinkLen}
                        onChange={(e) => setForceLinkLen(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                        disabled={!enablePhysics}
                      />
                      <span style={{ width: 48, textAlign: 'right' }}>{Math.round(forceLinkLen)}</span>
                    </label>
                    <button
                      style={{ marginTop: 6, padding: '6px 10px' }}
                      disabled={!enablePhysics}
                      onClick={() => {
                        setEnablePhysics(false);
                        setResetCounter((c) => c + 1);
                      }}
                    >
                      Reset layout
                    </button>
                  </>
                )}
              </aside>
            </div>
          </>
        )}
        {!loading && !error && xmlData && !treeFromArtboard && (
          <p style={{ fontFamily: 'system-ui, -apple-system' }}>
            No Artboard named "avatar_child_artboard" found.
          </p>
        )}
        {/* {xmlData && (
          <details style={{ marginTop: 12 }}>
            <summary>Raw JSON (from XML)</summary>
            <pre style={{ maxHeight: 320, overflow: 'auto' }}>
              {JSON.stringify(xmlData, null, 2)}
            </pre>
          </details>
        )} */}
        </div>
    </div>
  );
}

export default App;
