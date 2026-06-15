// ========================================================================
// Electric Grid Cycle Detection & Stability Analysis
// Algorithms: DFS, BFS, Union-Find, Kruskal's MST
// ADA Experiential Learning — SubPhase 2
// ========================================================================

// --- State Variables ---
let nodes = [];
let edges = [];
let mode = 'node'; // 'node', 'edge', or 'erase'
let draggedNode = null;
let edgeStartNode = null;
let cycleEdges = [];
let cycleNodes = [];
let mstEdges = [];       // edges in the MST
let rejectedEdges = [];  // edges rejected by MST (cycle-causing)
let isAnimating = false;
let analysisGeneration = 0;
let hoveredNode = null;
let hoveredEdge = null;
let animationSpeed = 50;
let stableGrid = false;
let powerFlowOffset = 0;
let animationFrameId = null;
let showMST = false;

// --- DOM Elements ---
const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');
const btnAddNode = document.getElementById('btn-add-node');
const btnAddEdge = document.getElementById('btn-add-edge');
const btnErase = document.getElementById('btn-erase');
const btnClear = document.getElementById('btn-clear');
const btnDfs = document.getElementById('btn-dfs');
const btnBfs = document.getElementById('btn-bfs');
const btnUf = document.getElementById('btn-uf');
const btnMst = document.getElementById('btn-mst');
const btnCompare = document.getElementById('btn-compare');
const btnResetAnalysis = document.getElementById('btn-reset-analysis');
const btnTestSuite = document.getElementById('btn-test-suite');
const speedSlider = document.getElementById('speed-slider');
const btnDemo1 = document.getElementById('btn-demo-1');
const btnDemo2 = document.getElementById('btn-demo-2');
const btnDemo3 = document.getElementById('btn-demo-3');
const btnDemoRandom = document.getElementById('btn-demo-random');
const btnDocs = document.getElementById('btn-show-docs');
const modal = document.getElementById('docs-modal');
const closeBtn = document.querySelector('.close-btn');
const statusIndicator = document.getElementById('status-indicator');
const logOutput = document.getElementById('log-output');
const comparisonContainer = document.getElementById('comparison-table-container');
const testResultsContainer = document.getElementById('test-results-container');

// --- Canvas Resize ---
function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    drawGraph();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- UI Logic ---
btnAddNode.addEventListener('click', () => setMode('node'));
btnAddEdge.addEventListener('click', () => setMode('edge'));
btnErase.addEventListener('click', () => setMode('erase'));

speedSlider.addEventListener('input', (e) => {
    animationSpeed = 101 - parseInt(e.target.value);
});

function setMode(newMode) {
    analysisGeneration++;
    isAnimating = false;
    mode = newMode;
    btnAddNode.classList.toggle('active', mode === 'node');
    btnAddEdge.classList.toggle('active', mode === 'edge');
    btnErase.classList.toggle('active', mode === 'erase');
    edgeStartNode = null;
}

function resetAnalysisState() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    cycleEdges = [];
    cycleNodes = [];
    mstEdges = [];
    rejectedEdges = [];
    stableGrid = false;
    showMST = false;
    nodes.forEach(n => delete n.state);
    edges.forEach(e => delete e.state);
    updateStatus('Awaiting Analysis', 'neutral');
    logOutput.innerHTML = '';
    comparisonContainer.style.display = 'none';
    log("Analysis reset.");
    drawGraph();
}

btnResetAnalysis.addEventListener('click', () => {
    analysisGeneration++;
    isAnimating = false;
    resetAnalysisState();
});

btnClear.addEventListener('click', () => {
    analysisGeneration++;
    isAnimating = false;
    nodes = [];
    edges = [];
    resetAnalysisState();
    log("Grid cleared.");
});

function log(msg) {
    const p = document.createElement('p');
    const time = new Date().toLocaleTimeString([], { hour12: false });
    p.textContent = `[${time}] ${msg}`;
    logOutput.appendChild(p);
    logOutput.scrollTop = logOutput.scrollHeight;
}

function updateStatus(text, type) {
    statusIndicator.textContent = text;
    statusIndicator.className = `status-box ${type}`;
}

// --- Modal Logic ---
btnDocs.addEventListener('click', () => modal.style.display = 'flex');
closeBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// --- Canvas Interactions ---
canvas.addEventListener('mousedown', (e) => {
    if (isAnimating) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedNode = hoveredNode;

    if (mode === 'erase') {
        if (clickedNode) {
            edges = edges.filter(edge => edge.u !== clickedNode.id && edge.v !== clickedNode.id);
            nodes = nodes.filter(n => n.id !== clickedNode.id);
            resetAnalysisState();
            log(`Deleted Substation ${clickedNode.id}`);
        } else if (hoveredEdge) {
            edges = edges.filter(edge => edge !== hoveredEdge);
            resetAnalysisState();
            log(`Deleted transmission line`);
        }
        drawGraph();
        return;
    }

    if (mode === 'node') {
        if (!clickedNode) {
            const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 0;
            nodes.push({ id: newId, x, y });
            resetAnalysisState();
            updateStatus('Grid Modified', 'neutral');
            drawGraph();
        } else {
            draggedNode = clickedNode;
        }
    } else if (mode === 'edge') {
        if (clickedNode) {
            edgeStartNode = clickedNode;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isAnimating) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = Math.max(20, Math.min(canvas.width - 20, x));
    y = Math.max(20, Math.min(canvas.height - 20, y));

    hoveredNode = nodes.find(n => Math.hypot(n.x - x, n.y - y) < 20) || null;
    hoveredEdge = null;
    if (!hoveredNode && mode === 'erase') {
        hoveredEdge = edges.find(edge => {
            const u = nodes.find(n => n.id === edge.u);
            const v = nodes.find(n => n.id === edge.v);
            if (!u || !v) return false;
            const l2 = Math.pow(u.x - v.x, 2) + Math.pow(u.y - v.y, 2);
            if (l2 === 0) return Math.hypot(u.x - x, u.y - y) < 10;
            let t = ((x - u.x) * (v.x - u.x) + (y - u.y) * (v.y - u.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = u.x + t * (v.x - u.x);
            const projY = u.y + t * (v.y - u.y);
            return Math.hypot(projX - x, projY - y) < 10;
        }) || null;
    }

    if (draggedNode && mode === 'node') {
        draggedNode.x = x;
        draggedNode.y = y;
        drawGraph();
    } else if (edgeStartNode && mode === 'edge') {
        drawGraph();
        ctx.beginPath();
        ctx.moveTo(edgeStartNode.x, edgeStartNode.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    } else {
        drawGraph();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (isAnimating) return;
    if (draggedNode) {
        draggedNode = null;
    } else if (edgeStartNode && mode === 'edge') {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const targetNode = nodes.find(n => Math.hypot(n.x - x, n.y - y) < 20);

        if (targetNode && targetNode !== edgeStartNode) {
            const exists = edges.some(e =>
                (e.u === edgeStartNode.id && e.v === targetNode.id) ||
                (e.u === targetNode.id && e.v === edgeStartNode.id)
            );
            if (!exists) {
                edges.push({ u: edgeStartNode.id, v: targetNode.id });
                resetAnalysisState();
                updateStatus('Grid Modified', 'neutral');
                log(`Added line between Substation ${edgeStartNode.id} and ${targetNode.id}`);
            }
        }
        edgeStartNode = null;
        drawGraph();
    }
});

// ========================================================================
// DRAWING
// ========================================================================
function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    edges.forEach(edge => {
        const u = nodes.find(n => n.id === edge.u);
        const v = nodes.find(n => n.id === edge.v);
        if (!u || !v) return;

        const isCycle = cycleEdges.some(ce =>
            (ce[0] === u.id && ce[1] === v.id) || (ce[0] === v.id && ce[1] === u.id)
        );
        const isRejected = rejectedEdges.some(re =>
            (re[0] === u.id && re[1] === v.id) || (re[0] === v.id && re[1] === u.id)
        );
        const isMST = mstEdges.some(me =>
            (me[0] === u.id && me[1] === v.id) || (me[0] === v.id && me[1] === u.id)
        );
        const isHovered = (edge === hoveredEdge);

        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(v.x, v.y);

        if (showMST && isRejected) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 6]);
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 8;
        } else if (showMST && isMST) {
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 4;
            ctx.setLineDash([]);
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 12;
        } else if (isCycle) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 4;
            ctx.setLineDash([]);
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 10;
        } else if (edge.state === 'visiting') {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 4;
            ctx.setLineDash([]);
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 15;
        } else if (edge.state === 'visited') {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        } else if (isHovered) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth = 4;
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Power flow animation for stable grids
        if (stableGrid && !isCycle && !isRejected) {
            ctx.beginPath();
            const dx = v.x - u.x;
            const dy = v.y - u.y;
            const dist = Math.hypot(dx, dy);
            const dashCount = Math.floor(dist / 20);
            for (let i = 0; i < dashCount; i++) {
                let t = ((i * 20 + powerFlowOffset) % dist) / dist;
                ctx.arc(u.x + dx * t, u.y + dy * t, 3, 0, Math.PI * 2);
            }
            ctx.fillStyle = '#10b981';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // MST label on rejected edges
        if (showMST && isRejected) {
            const mx = (u.x + v.x) / 2;
            const my = (u.y + v.y) / 2;
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 11px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText('REDUNDANT', mx, my - 10);
        }
    });

    // Draw nodes
    nodes.forEach(node => {
        const isCycle = cycleNodes.includes(node.id);
        const isHovered = (node === hoveredNode);

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? 20 : 16, 0, Math.PI * 2);

        if (isCycle) {
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#fca5a5';
        } else if (node.state === 'visiting') {
            ctx.fillStyle = '#f59e0b';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#fde68a';
        } else if (node.state === 'visited') {
            ctx.fillStyle = '#1e3a8a';
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#3b82f6';
        } else if (isHovered && mode === 'erase') {
            ctx.fillStyle = '#450a0a';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#ef4444';
        } else {
            ctx.fillStyle = '#0f172a';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = isHovered ? 20 : 10;
            ctx.strokeStyle = '#00f0ff';
        }

        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Node ID label
        ctx.fillStyle = '#fff';
        ctx.font = '12px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id, node.x, node.y);
    });
}

function animatePowerFlow() {
    if (stableGrid) {
        powerFlowOffset -= 0.5;
        if (powerFlowOffset < 0) powerFlowOffset = 20;
        drawGraph();
        animationFrameId = requestAnimationFrame(animatePowerFlow);
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function findEdge(uId, vId) {
    return edges.find(e => (e.u === uId && e.v === vId) || (e.u === vId && e.v === uId));
}

function buildAdjList() {
    const adj = {};
    nodes.forEach(n => adj[n.id] = []);
    edges.forEach(e => {
        if (adj[e.u] && adj[e.v]) {
            adj[e.u].push(e.v);
            adj[e.v].push(e.u);
        }
    });
    return adj;
}

// ========================================================================
// ALGORITHM 1: DFS CYCLE DETECTION
// ========================================================================
btnDfs.addEventListener('click', async () => {
    analysisGeneration++;
    const currentGen = analysisGeneration;
    isAnimating = true;
    showMST = false;
    log("Running DFS Cycle Detection...");

    nodes.forEach(n => delete n.state);
    edges.forEach(e => delete e.state);
    cycleEdges = [];
    cycleNodes = [];
    mstEdges = [];
    rejectedEdges = [];
    stableGrid = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    drawGraph();

    const adj = buildAdjList();
    const visited = {};
    const parentMap = {};
    nodes.forEach(n => {
        visited[n.id] = false;
        parentMap[n.id] = -1;
    });

    let cycleFound = false;

    async function dfs(v, p) {
        if (currentGen !== analysisGeneration) return false;
        visited[v] = true;
        parentMap[v] = p;
        const node = nodes.find(n => n.id === v);
        if (node) {
            node.state = 'visiting';
            log(`DFS: Visiting Substation ${v}`);
            drawGraph();
            await sleep(animationSpeed);
        }

        for (let neighbor of adj[v]) {
            if (currentGen !== analysisGeneration) return false;
            if (!visited[neighbor]) {
                const edge = findEdge(v, neighbor);
                if (edge) {
                    edge.state = 'visiting';
                    drawGraph();
                    await sleep(animationSpeed);
                }
                if (await dfs(neighbor, v)) return true;
                if (currentGen !== analysisGeneration) return false;
                if (edge) {
                    edge.state = 'visited';
                    drawGraph();
                }
            } else if (neighbor !== p) {
                cycleFound = true;
                log(`DFS: ALERT! Back-edge found: ${v} → ${neighbor}. Cycle detected!`);
                let curr = v;
                cycleEdges.push([v, neighbor]);
                cycleNodes.push(neighbor);
                while (curr !== neighbor && curr !== -1 && curr !== undefined) {
                    cycleNodes.push(curr);
                    const parent = parentMap[curr];
                    if (parent !== -1 && parent !== undefined) {
                        cycleEdges.push([curr, parent]);
                    }
                    curr = parent;
                }
                drawGraph();
                return true;
            }
        }

        if (node) {
            node.state = 'visited';
            drawGraph();
            await sleep(animationSpeed);
        }
        return false;
    }

    const t0 = performance.now();
    for (let node of nodes) {
        if (!visited[node.id]) {
            if (await dfs(node.id, -1)) break;
        }
    }
    const t1 = performance.now();

    if (currentGen !== analysisGeneration) return;

    log(`DFS Execution Time: ${(t1 - t0).toFixed(4)}ms`);
    isAnimating = false;
    if (cycleFound) {
        log("Result: CYCLE DETECTED! Grid Unstable.");
        updateStatus('Cycle Detected! Grid Unstable', 'danger');
    } else {
        log("Result: No cycles. Grid Stable.");
        updateStatus('Grid Stable ✓', 'success');
        stableGrid = true;
        animatePowerFlow();
    }
    drawGraph();
});

// ========================================================================
// ALGORITHM 2: BFS CYCLE DETECTION
// ========================================================================
btnBfs.addEventListener('click', async () => {
    analysisGeneration++;
    const currentGen = analysisGeneration;
    isAnimating = true;
    showMST = false;
    log("Running BFS Cycle Detection...");

    nodes.forEach(n => delete n.state);
    edges.forEach(e => delete e.state);
    cycleEdges = [];
    cycleNodes = [];
    mstEdges = [];
    rejectedEdges = [];
    stableGrid = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    drawGraph();

    const adj = buildAdjList();
    const visited = {};
    const parentMap = {};
    nodes.forEach(n => {
        visited[n.id] = false;
        parentMap[n.id] = -1;
    });

    let cycleFound = false;
    let cycleU = -1, cycleV = -1;

    const t0 = performance.now();

    for (let startNode of nodes) {
        if (visited[startNode.id]) continue;
        if (currentGen !== analysisGeneration) { isAnimating = false; return; }

        const queue = [startNode.id];
        visited[startNode.id] = true;
        const sn = nodes.find(n => n.id === startNode.id);
        if (sn) {
            sn.state = 'visiting';
            log(`BFS: Starting from Substation ${startNode.id}`);
            drawGraph();
            await sleep(animationSpeed);
        }

        while (queue.length > 0 && !cycleFound) {
            if (currentGen !== analysisGeneration) { isAnimating = false; return; }
            const current = queue.shift();
            const currentNode = nodes.find(n => n.id === current);

            for (let neighbor of adj[current]) {
                if (currentGen !== analysisGeneration) { isAnimating = false; return; }

                if (!visited[neighbor]) {
                    visited[neighbor] = true;
                    parentMap[neighbor] = current;
                    queue.push(neighbor);

                    const nNode = nodes.find(n => n.id === neighbor);
                    if (nNode) nNode.state = 'visiting';
                    const edge = findEdge(current, neighbor);
                    if (edge) edge.state = 'visiting';
                    log(`BFS: Exploring ${current} → ${neighbor}`);
                    drawGraph();
                    await sleep(animationSpeed);

                    if (edge) edge.state = 'visited';
                } else if (neighbor !== parentMap[current]) {
                    // Cycle detected
                    cycleFound = true;
                    cycleU = current;
                    cycleV = neighbor;
                    log(`BFS: ALERT! ${current} → ${neighbor} forms a cycle (both already visited)!`);

                    // Reconstruct cycle path using BFS parent pointers
                    // Find common ancestor from both ends
                    const pathU = [];
                    const pathV = [];
                    let a = cycleU, b = cycleV;
                    const depthU = {};
                    const depthV = {};
                    let cu = cycleU;
                    while (cu !== -1 && cu !== undefined) {
                        pathU.push(cu);
                        cu = parentMap[cu];
                    }
                    let cv = cycleV;
                    while (cv !== -1 && cv !== undefined) {
                        pathV.push(cv);
                        cv = parentMap[cv];
                    }
                    // Find LCA
                    const setU = new Set(pathU);
                    let lca = -1;
                    for (let nd of pathV) {
                        if (setU.has(nd)) { lca = nd; break; }
                    }

                    // Build cycle path
                    cycleEdges.push([cycleU, cycleV]);
                    let c = cycleU;
                    while (c !== lca && c !== -1) {
                        cycleNodes.push(c);
                        const p = parentMap[c];
                        if (p !== -1) cycleEdges.push([c, p]);
                        c = p;
                    }
                    cycleNodes.push(lca);
                    c = cycleV;
                    const tempPath = [];
                    while (c !== lca && c !== -1) {
                        tempPath.push(c);
                        c = parentMap[c];
                    }
                    for (let i = 0; i < tempPath.length; i++) {
                        cycleNodes.push(tempPath[i]);
                        const next = i + 1 < tempPath.length ? tempPath[i + 1] : lca;
                        cycleEdges.push([tempPath[i], next]);
                    }

                    drawGraph();
                    break;
                }
            }

            if (currentNode) currentNode.state = 'visited';
            drawGraph();
            await sleep(animationSpeed / 2);
        }
        if (cycleFound) break;
    }

    const t1 = performance.now();
    if (currentGen !== analysisGeneration) return;

    log(`BFS Execution Time: ${(t1 - t0).toFixed(4)}ms`);
    isAnimating = false;
    if (cycleFound) {
        log("Result: CYCLE DETECTED! Grid Unstable.");
        updateStatus('Cycle Detected! Grid Unstable', 'danger');
    } else {
        log("Result: No cycles. Grid Stable.");
        updateStatus('Grid Stable ✓', 'success');
        stableGrid = true;
        animatePowerFlow();
    }
    drawGraph();
});

// ========================================================================
// ALGORITHM 3: UNION-FIND CYCLE DETECTION
// ========================================================================
btnUf.addEventListener('click', async () => {
    analysisGeneration++;
    const currentGen = analysisGeneration;
    isAnimating = true;
    showMST = false;
    log("Running Union-Find Cycle Detection...");

    nodes.forEach(n => delete n.state);
    edges.forEach(e => delete e.state);
    cycleEdges = [];
    cycleNodes = [];
    mstEdges = [];
    rejectedEdges = [];
    stableGrid = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    drawGraph();

    const parent = {};
    const rank = {};
    nodes.forEach(n => {
        parent[n.id] = n.id;
        rank[n.id] = 0;
    });

    let cycleFound = false;

    function find(i) {
        if (parent[i] !== i) {
            parent[i] = find(parent[i]); // Path compression
        }
        return parent[i];
    }

    async function union(i, j, edge) {
        if (currentGen !== analysisGeneration) return null;
        edge.state = 'visiting';
        const nodeI = nodes.find(n => n.id === i);
        const nodeJ = nodes.find(n => n.id === j);
        if (nodeI) nodeI.state = 'visiting';
        if (nodeJ) nodeJ.state = 'visiting';
        log(`Union-Find: Checking edge (${i}, ${j})...`);
        drawGraph();
        await sleep(animationSpeed * 1.5);
        if (currentGen !== analysisGeneration) return null;

        const rootI = find(i);
        const rootJ = find(j);

        if (rootI === rootJ) {
            edge.state = 'visited';
            if (nodeI) nodeI.state = 'visited';
            if (nodeJ) nodeJ.state = 'visited';
            return false; // Same set → cycle
        }

        if (rank[rootI] < rank[rootJ]) {
            parent[rootI] = rootJ;
        } else if (rank[rootI] > rank[rootJ]) {
            parent[rootJ] = rootI;
        } else {
            parent[rootJ] = rootI;
            rank[rootI]++;
        }

        edge.state = 'visited';
        if (nodeI) nodeI.state = 'visited';
        if (nodeJ) nodeJ.state = 'visited';
        drawGraph();
        await sleep(animationSpeed);
        return true;
    }

    const t0 = performance.now();
    for (let e of edges) {
        const res = await union(e.u, e.v, e);
        if (res === null) return;
        if (!res) {
            cycleFound = true;
            log(`Union-Find: ALERT! (${e.u}, ${e.v}) are already in the same set! Cycle!`);
            cycleEdges.push([e.u, e.v]);
            cycleNodes.push(e.u, e.v);
            break;
        } else {
            log(`Union-Find: Merged sets of ${e.u} and ${e.v}.`);
        }
    }
    const t1 = performance.now();

    if (currentGen !== analysisGeneration) return;

    log(`Union-Find Execution Time: ${(t1 - t0).toFixed(4)}ms`);
    isAnimating = false;
    if (cycleFound) {
        log("Result: CYCLE DETECTED! Grid Unstable.");
        updateStatus('Cycle Detected! Grid Unstable', 'danger');
    } else {
        log("Result: No cycles. Grid Stable.");
        updateStatus('Grid Stable ✓', 'success');
        stableGrid = true;
        animatePowerFlow();
    }
    drawGraph();
});

// ========================================================================
// ALGORITHM 4: KRUSKAL'S MST (Cycle Elimination Perspective)
// ========================================================================
btnMst.addEventListener('click', async () => {
    analysisGeneration++;
    const currentGen = analysisGeneration;
    isAnimating = true;
    showMST = false;
    log("Running Kruskal's MST Analysis...");

    nodes.forEach(n => delete n.state);
    edges.forEach(e => delete e.state);
    cycleEdges = [];
    cycleNodes = [];
    mstEdges = [];
    rejectedEdges = [];
    stableGrid = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    drawGraph();

    const parent = {};
    const rank = {};
    nodes.forEach(n => {
        parent[n.id] = n.id;
        rank[n.id] = 0;
    });

    function find(i) {
        if (parent[i] !== i) parent[i] = find(parent[i]);
        return parent[i];
    }

    const t0 = performance.now();

    for (let e of edges) {
        if (currentGen !== analysisGeneration) { isAnimating = false; return; }
        e.state = 'visiting';
        const nodeU = nodes.find(n => n.id === e.u);
        const nodeV = nodes.find(n => n.id === e.v);
        if (nodeU) nodeU.state = 'visiting';
        if (nodeV) nodeV.state = 'visiting';
        drawGraph();
        await sleep(animationSpeed * 1.5);

        if (currentGen !== analysisGeneration) { isAnimating = false; return; }

        const rootU = find(e.u);
        const rootV = find(e.v);

        if (rootU === rootV) {
            // Rejected — would create cycle
            rejectedEdges.push([e.u, e.v]);
            log(`MST: Edge (${e.u}, ${e.v}) REJECTED — would create cycle (redundant line).`);
        } else {
            // Accept — part of MST
            mstEdges.push([e.u, e.v]);
            if (rank[rootU] < rank[rootV]) parent[rootU] = rootV;
            else if (rank[rootU] > rank[rootV]) parent[rootV] = rootU;
            else { parent[rootV] = rootU; rank[rootU]++; }
            log(`MST: Edge (${e.u}, ${e.v}) ACCEPTED — added to spanning tree.`);
        }

        e.state = 'visited';
        if (nodeU) nodeU.state = 'visited';
        if (nodeV) nodeV.state = 'visited';
        drawGraph();
        await sleep(animationSpeed);
    }

    const t1 = performance.now();
    if (currentGen !== analysisGeneration) return;

    showMST = true;
    isAnimating = false;

    log(`Kruskal's MST Execution Time: ${(t1 - t0).toFixed(4)}ms`);
    log(`MST edges: ${mstEdges.length} | Redundant edges: ${rejectedEdges.length}`);

    if (rejectedEdges.length > 0) {
        updateStatus(`${rejectedEdges.length} Redundant Line(s) Found`, 'mst-status');
        log(`Grid has cycles. Remove ${rejectedEdges.length} line(s) for stability.`);
    } else {
        updateStatus('Grid is Already a Spanning Tree ✓', 'success');
        log("No redundant edges. Grid is already minimal and stable.");
        stableGrid = true;
        animatePowerFlow();
    }
    drawGraph();
});

// ========================================================================
// COMPARE ALL ALGORITHMS
// ========================================================================
btnCompare.addEventListener('click', async () => {
    if (nodes.length === 0) {
        log("No nodes to analyse. Draw a grid first.");
        return;
    }

    analysisGeneration++;
    isAnimating = true;
    showMST = false;
    nodes.forEach(n => delete n.state);
    edges.forEach(e => delete e.state);
    cycleEdges = [];
    cycleNodes = [];
    mstEdges = [];
    rejectedEdges = [];
    stableGrid = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    drawGraph();

    log("Running ALL algorithms for comparison (silent mode)...");
    updateStatus('Comparing Algorithms...', 'neutral');

    const results = {};
    const adj = buildAdjList();

    // --- DFS (silent) ---
    {
        const visited = {};
        const parentMap = {};
        nodes.forEach(n => { visited[n.id] = false; parentMap[n.id] = -1; });
        let cycleFound = false;

        function dfsSilent(v, p) {
            visited[v] = true;
            parentMap[v] = p;
            for (let neighbor of adj[v]) {
                if (!visited[neighbor]) {
                    if (dfsSilent(neighbor, v)) return true;
                } else if (neighbor !== p) {
                    cycleFound = true;
                    return true;
                }
            }
            return false;
        }

        const t0 = performance.now();
        for (let node of nodes) {
            if (!visited[node.id]) {
                if (dfsSilent(node.id, -1)) break;
            }
        }
        const t1 = performance.now();
        results.dfs = { cycle: cycleFound, time: (t1 - t0).toFixed(4) };
    }

    // --- BFS (silent) ---
    {
        const visited = {};
        const parentMap = {};
        nodes.forEach(n => { visited[n.id] = false; parentMap[n.id] = -1; });
        let cycleFound = false;

        const t0 = performance.now();
        for (let startNode of nodes) {
            if (visited[startNode.id]) continue;
            const queue = [startNode.id];
            visited[startNode.id] = true;
            while (queue.length > 0 && !cycleFound) {
                const current = queue.shift();
                for (let neighbor of adj[current]) {
                    if (!visited[neighbor]) {
                        visited[neighbor] = true;
                        parentMap[neighbor] = current;
                        queue.push(neighbor);
                    } else if (neighbor !== parentMap[current]) {
                        cycleFound = true;
                        break;
                    }
                }
            }
            if (cycleFound) break;
        }
        const t1 = performance.now();
        results.bfs = { cycle: cycleFound, time: (t1 - t0).toFixed(4) };
    }

    // --- Union-Find (silent) ---
    {
        const parent = {};
        const rank = {};
        nodes.forEach(n => { parent[n.id] = n.id; rank[n.id] = 0; });
        let cycleFound = false;

        function find(i) {
            if (parent[i] !== i) parent[i] = find(parent[i]);
            return parent[i];
        }

        const t0 = performance.now();
        for (let e of edges) {
            const rootU = find(e.u);
            const rootV = find(e.v);
            if (rootU === rootV) {
                cycleFound = true;
                break;
            }
            if (rank[rootU] < rank[rootV]) parent[rootU] = rootV;
            else if (rank[rootU] > rank[rootV]) parent[rootV] = rootU;
            else { parent[rootV] = rootU; rank[rootU]++; }
        }
        const t1 = performance.now();
        results.uf = { cycle: cycleFound, time: (t1 - t0).toFixed(4) };
    }

    // --- Kruskal's MST (silent) ---
    {
        const parent = {};
        const rank = {};
        nodes.forEach(n => { parent[n.id] = n.id; rank[n.id] = 0; });
        let redundant = 0;

        function find(i) {
            if (parent[i] !== i) parent[i] = find(parent[i]);
            return parent[i];
        }

        const t0 = performance.now();
        for (let e of edges) {
            const rootU = find(e.u);
            const rootV = find(e.v);
            if (rootU === rootV) {
                redundant++;
            } else {
                if (rank[rootU] < rank[rootV]) parent[rootU] = rootV;
                else if (rank[rootU] > rank[rootV]) parent[rootV] = rootU;
                else { parent[rootV] = rootU; rank[rootU]++; }
            }
        }
        const t1 = performance.now();
        results.mst = { cycle: redundant > 0, redundant, time: (t1 - t0).toFixed(4) };
    }

    isAnimating = false;

    // Agreement check
    const allAgree = results.dfs.cycle === results.bfs.cycle &&
        results.bfs.cycle === results.uf.cycle &&
        results.uf.cycle === results.mst.cycle;

    // Display comparison table
    comparisonContainer.style.display = 'block';
    comparisonContainer.innerHTML = `
        <table class="comparison-mini-table">
            <thead>
                <tr><th>Algorithm</th><th>Cycle?</th><th>Time (ms)</th></tr>
            </thead>
            <tbody>
                <tr><td>DFS</td><td class="${results.dfs.cycle ? 'fail' : 'pass'}">${results.dfs.cycle ? 'YES' : 'NO'}</td><td>${results.dfs.time}</td></tr>
                <tr><td>BFS</td><td class="${results.bfs.cycle ? 'fail' : 'pass'}">${results.bfs.cycle ? 'YES' : 'NO'}</td><td>${results.bfs.time}</td></tr>
                <tr><td>Union-Find</td><td class="${results.uf.cycle ? 'fail' : 'pass'}">${results.uf.cycle ? 'YES' : 'NO'}</td><td>${results.uf.time}</td></tr>
                <tr><td>Kruskal's MST</td><td class="${results.mst.cycle ? 'fail' : 'pass'}">${results.mst.cycle ? 'YES' : 'NO'}</td><td>${results.mst.time}</td></tr>
            </tbody>
        </table>
        <div class="test-summary ${allAgree ? 'all-pass' : 'some-fail'}">
            ${allAgree ? '✓ All algorithms agree' : '⚠ Algorithms disagree!'}
        </div>
    `;

    log("Comparison complete. See table above.");
    Object.entries(results).forEach(([k, v]) => {
        log(`${k.toUpperCase()}: cycle=${v.cycle}, time=${v.time}ms`);
    });

    if (results.dfs.cycle) {
        updateStatus('Cycle Detected (All Algos Agree)', 'danger');
    } else {
        updateStatus('Grid Stable (All Algos Agree) ✓', 'success');
        stableGrid = true;
        animatePowerFlow();
    }
    drawGraph();
});

// ========================================================================
// AUTOMATED TEST SUITE
// ========================================================================
btnTestSuite.addEventListener('click', () => {
    log("Running automated test suite...");

    const testCases = [
        {
            name: "Empty graph",
            nodes: [],
            edges: [],
            expected: false
        },
        {
            name: "Single node",
            nodes: [{ id: 0 }],
            edges: [],
            expected: false
        },
        {
            name: "Two nodes, one edge",
            nodes: [{ id: 0 }, { id: 1 }],
            edges: [{ u: 0, v: 1 }],
            expected: false
        },
        {
            name: "Triangle (3-cycle)",
            nodes: [{ id: 0 }, { id: 1 }, { id: 2 }],
            edges: [{ u: 0, v: 1 }, { u: 1, v: 2 }, { u: 2, v: 0 }],
            expected: true
        },
        {
            name: "Linear chain (5 nodes)",
            nodes: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
            edges: [{ u: 0, v: 1 }, { u: 1, v: 2 }, { u: 2, v: 3 }, { u: 3, v: 4 }],
            expected: false
        },
        {
            name: "Square cycle (4 nodes)",
            nodes: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }],
            edges: [{ u: 0, v: 1 }, { u: 1, v: 2 }, { u: 2, v: 3 }, { u: 3, v: 0 }],
            expected: true
        },
        {
            name: "Disconnected: tree + cycle",
            nodes: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
            edges: [{ u: 0, v: 1 }, { u: 2, v: 3 }, { u: 3, v: 4 }, { u: 4, v: 2 }],
            expected: true
        },
        {
            name: "Star graph (no cycle)",
            nodes: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
            edges: [{ u: 0, v: 1 }, { u: 0, v: 2 }, { u: 0, v: 3 }, { u: 0, v: 4 }],
            expected: false
        },
        {
            name: "Complete K4 (many cycles)",
            nodes: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }],
            edges: [
                { u: 0, v: 1 }, { u: 0, v: 2 }, { u: 0, v: 3 },
                { u: 1, v: 2 }, { u: 1, v: 3 }, { u: 2, v: 3 }
            ],
            expected: true
        },
        {
            name: "Binary tree (7 nodes, no cycle)",
            nodes: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
            edges: [
                { u: 0, v: 1 }, { u: 0, v: 2 },
                { u: 1, v: 3 }, { u: 1, v: 4 },
                { u: 2, v: 5 }, { u: 2, v: 6 }
            ],
            expected: false
        },
        {
            name: "Large ring (8-cycle)",
            nodes: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }],
            edges: [
                { u: 0, v: 1 }, { u: 1, v: 2 }, { u: 2, v: 3 }, { u: 3, v: 4 },
                { u: 4, v: 5 }, { u: 5, v: 6 }, { u: 6, v: 7 }, { u: 7, v: 0 }
            ],
            expected: true
        }
    ];

    // Silent algorithm implementations for testing
    function dfsSilent(testNodes, testEdges) {
        const adj = {};
        testNodes.forEach(n => adj[n.id] = []);
        testEdges.forEach(e => {
            if (adj[e.u] !== undefined && adj[e.v] !== undefined) {
                adj[e.u].push(e.v);
                adj[e.v].push(e.u);
            }
        });
        const visited = {};
        testNodes.forEach(n => visited[n.id] = false);

        function dfs(v, p) {
            visited[v] = true;
            for (let u of (adj[v] || [])) {
                if (!visited[u]) {
                    if (dfs(u, v)) return true;
                } else if (u !== p) return true;
            }
            return false;
        }

        for (let n of testNodes) {
            if (!visited[n.id]) {
                if (dfs(n.id, -1)) return true;
            }
        }
        return false;
    }

    function bfsSilent(testNodes, testEdges) {
        const adj = {};
        testNodes.forEach(n => adj[n.id] = []);
        testEdges.forEach(e => {
            if (adj[e.u] !== undefined && adj[e.v] !== undefined) {
                adj[e.u].push(e.v);
                adj[e.v].push(e.u);
            }
        });
        const visited = {};
        const parentMap = {};
        testNodes.forEach(n => { visited[n.id] = false; parentMap[n.id] = -1; });

        for (let startNode of testNodes) {
            if (visited[startNode.id]) continue;
            const queue = [startNode.id];
            visited[startNode.id] = true;
            while (queue.length > 0) {
                const current = queue.shift();
                for (let neighbor of (adj[current] || [])) {
                    if (!visited[neighbor]) {
                        visited[neighbor] = true;
                        parentMap[neighbor] = current;
                        queue.push(neighbor);
                    } else if (neighbor !== parentMap[current]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function ufSilent(testNodes, testEdges) {
        const parent = {};
        const rank = {};
        testNodes.forEach(n => { parent[n.id] = n.id; rank[n.id] = 0; });

        function find(i) {
            if (parent[i] !== i) parent[i] = find(parent[i]);
            return parent[i];
        }

        for (let e of testEdges) {
            const ru = find(e.u);
            const rv = find(e.v);
            if (ru === rv) return true;
            if (rank[ru] < rank[rv]) parent[ru] = rv;
            else if (rank[ru] > rank[rv]) parent[rv] = ru;
            else { parent[rv] = ru; rank[ru]++; }
        }
        return false;
    }

    function mstSilent(testNodes, testEdges) {
        const parent = {};
        const rank = {};
        testNodes.forEach(n => { parent[n.id] = n.id; rank[n.id] = 0; });
        let redundant = 0;

        function find(i) {
            if (parent[i] !== i) parent[i] = find(parent[i]);
            return parent[i];
        }

        for (let e of testEdges) {
            const ru = find(e.u);
            const rv = find(e.v);
            if (ru === rv) redundant++;
            else {
                if (rank[ru] < rank[rv]) parent[ru] = rv;
                else if (rank[ru] > rank[rv]) parent[rv] = ru;
                else { parent[rv] = ru; rank[ru]++; }
            }
        }
        return redundant > 0;
    }

    // Run all tests
    let totalPass = 0;
    let totalFail = 0;
    const rows = testCases.map(tc => {
        const dfsResult = dfsSilent(tc.nodes, tc.edges);
        const bfsResult = bfsSilent(tc.nodes, tc.edges);
        const ufResult = ufSilent(tc.nodes, tc.edges);
        const mstResult = mstSilent(tc.nodes, tc.edges);

        const dfsOk = dfsResult === tc.expected;
        const bfsOk = bfsResult === tc.expected;
        const ufOk = ufResult === tc.expected;
        const mstOk = mstResult === tc.expected;
        const allOk = dfsOk && bfsOk && ufOk && mstOk;

        if (allOk) totalPass++;
        else totalFail++;

        return `<tr>
            <td>${tc.name}</td>
            <td>${tc.expected ? 'Y' : 'N'}</td>
            <td class="${dfsOk ? 'test-pass' : 'test-fail'}">${dfsResult ? 'Y' : 'N'}</td>
            <td class="${bfsOk ? 'test-pass' : 'test-fail'}">${bfsResult ? 'Y' : 'N'}</td>
            <td class="${ufOk ? 'test-pass' : 'test-fail'}">${ufResult ? 'Y' : 'N'}</td>
            <td class="${mstOk ? 'test-pass' : 'test-fail'}">${mstResult ? 'Y' : 'N'}</td>
            <td class="${allOk ? 'test-pass' : 'test-fail'}">${allOk ? '✓' : '✗'}</td>
        </tr>`;
    });

    testResultsContainer.style.display = 'block';
    testResultsContainer.innerHTML = `
        <table class="test-results-table">
            <thead>
                <tr><th>Test Case</th><th>Exp.</th><th>DFS</th><th>BFS</th><th>UF</th><th>MST</th><th>Pass</th></tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
        </table>
        <div class="test-summary ${totalFail === 0 ? 'all-pass' : 'some-fail'}">
            ${totalFail === 0 ? `✓ All ${totalPass} tests passed!` : `${totalPass} passed, ${totalFail} failed`}
        </div>
    `;

    log(`Test suite complete: ${totalPass}/${testCases.length} passed.`);
    if (totalFail === 0) {
        updateStatus(`All ${totalPass} Tests Passed ✓`, 'success');
    } else {
        updateStatus(`${totalFail} Test(s) Failed`, 'danger');
    }
});

// ========================================================================
// DEMO PRESETS
// ========================================================================
function loadDemo(type) {
    analysisGeneration++;
    isAnimating = false;
    nodes = [];
    edges = [];
    resetAnalysisState();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    if (type === 'stable') {
        nodes.push({ id: 0, x: cx - 150, y: cy - 100 });
        nodes.push({ id: 1, x: cx + 50, y: cy - 150 });
        nodes.push({ id: 2, x: cx + 150, y: cy + 50 });
        nodes.push({ id: 3, x: cx - 50, y: cy + 150 });

        edges.push({ u: 0, v: 1 });
        edges.push({ u: 1, v: 2 });
        edges.push({ u: 2, v: 3 });
        log("Loaded Stable Demo (tree — no cycles).");
    } else if (type === 'unstable') {
        nodes.push({ id: 0, x: cx - 100, y: cy - 100 });
        nodes.push({ id: 1, x: cx + 100, y: cy - 100 });
        nodes.push({ id: 2, x: cx + 100, y: cy + 100 });
        nodes.push({ id: 3, x: cx - 100, y: cy + 100 });

        edges.push({ u: 0, v: 1 });
        edges.push({ u: 1, v: 2 });
        edges.push({ u: 2, v: 3 });
        edges.push({ u: 3, v: 0 }); // cycle!
        log("Loaded Unstable Demo (square loop — 1 cycle).");
    } else if (type === 'complex') {
        nodes.push({ id: 0, x: cx - 200, y: cy - 50 });
        nodes.push({ id: 1, x: cx - 100, y: cy - 150 });
        nodes.push({ id: 2, x: cx + 100, y: cy - 150 });
        nodes.push({ id: 3, x: cx + 200, y: cy - 50 });
        nodes.push({ id: 4, x: cx + 100, y: cy + 150 });
        nodes.push({ id: 5, x: cx - 100, y: cy + 150 });
        nodes.push({ id: 6, x: cx, y: cy }); // central hub

        edges.push({ u: 0, v: 1 });
        edges.push({ u: 1, v: 2 });
        edges.push({ u: 2, v: 3 });
        edges.push({ u: 3, v: 4 });
        edges.push({ u: 4, v: 5 });
        edges.push({ u: 5, v: 0 });
        edges.push({ u: 1, v: 6 });
        edges.push({ u: 3, v: 6 });
        edges.push({ u: 5, v: 6 });
        log("Loaded Complex Demo (hub with multiple cycles).");
    } else if (type === 'random') {
        const numNodes = Math.floor(Math.random() * 5) + 5;
        for (let i = 0; i < numNodes; i++) {
            nodes.push({
                id: i,
                x: Math.random() * (canvas.width - 100) + 50,
                y: Math.random() * (canvas.height - 100) + 50
            });
        }
        const numEdges = numNodes + Math.floor(Math.random() * 4) - 2;
        let edgesAdded = 0;
        let attempts = 0;
        while (edgesAdded < numEdges && attempts < 100) {
            attempts++;
            const u = Math.floor(Math.random() * numNodes);
            const v = Math.floor(Math.random() * numNodes);
            if (u !== v) {
                const exists = edges.some(e => (e.u === u && e.v === v) || (e.u === v && e.v === u));
                if (!exists) {
                    edges.push({ u, v });
                    edgesAdded++;
                }
            }
        }
        log(`Generated Random Grid: ${nodes.length} substations, ${edges.length} lines.`);
    }
    drawGraph();
}

btnDemo1.addEventListener('click', () => loadDemo('stable'));
btnDemo2.addEventListener('click', () => loadDemo('unstable'));
btnDemo3.addEventListener('click', () => loadDemo('complex'));
btnDemoRandom.addEventListener('click', () => loadDemo('random'));

window.onload = () => {
    loadDemo('stable');
    log("System initialized. Select a demo or draw your own grid.");
};
