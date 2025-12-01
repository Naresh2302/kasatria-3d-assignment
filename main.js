// main.js
// ---------------- Google Sheets config ----------------
const API_KEY = "AIzaSyBqtzCfxsPUzoGEn0zIobwuNbuwvUOVf28"; 
const SPREADSHEET_ID = "1v-ioTC98S4aERKPYd3tstJaElaceASz8d-3wdjnMcKk";
const SHEET_RANGE = "Data Template!A2:F"; // Name, Photo, Age, Country, Interest, Net Worth

// ---------------- Google Sign-In callback ----------------

// This is the function Google calls after a successful login
window.handleCredentialResponse = function (response) {
  console.log("Google ID token:", response.credential);

  // 1. Hide login card
  const loginCard = document.getElementById("login-card");
  if (loginCard) loginCard.style.display = "none";

  // 2. Show 3D app container
  const app = document.getElementById("app");
  app.style.display = "block";

  // 3. Inject 3D layout HTML (three container + legend + menu)
  app.innerHTML = `
    <div id="three-container"></div>

    <!-- Legend ABOVE menu -->
    <div id="legend">
      <span class="legend-label legend-low">LOW</span>
      <div class="legend-bar">
        <div class="legend-gradient"></div>
      </div>
      <span class="legend-label legend-high">HIGH</span>
    </div>

    <div id="menu">
      <button id="btn-table">TABLE</button>
      <button id="btn-sphere">SPHERE</button>
      <button id="btn-helix">HELIX</button>
      <button id="btn-grid">GRID</button>
    </div>
  `;

  // 4. Load data then start Three.js scene
  loadDataAndStart();
};

// ---------------- Three.js globals ----------------
let camera, scene, renderer;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };
let dummyData = []; // filled from Google Sheets
let controls;       // Trackball controls

// ---------------- Data loading (Google Sheets) ----------------
async function loadDataAndStart() {
  try {
    const encodedRange = encodeURIComponent(SHEET_RANGE);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/1v-ioTC98S4aERKPYd3tstJaElaceASz8d-3wdjnMcKk/values/Data%20Template!A2:F?key=AIzaSyBqtzCfxsPUzoGEn0zIobwuNbuwvUOVf28
`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    const rows = data.values || [];

    // Convert rows into objects matching our previous dummyData structure
    dummyData = rows.map((r) => ({
      Name: r[0] || "Unknown",        // A: Name
      Photo: r[1] || "",              // B: Photo URL
      Age: r[2] || "Unknown",         // C: Age
      Country: r[3] || "Unknown",     // D: Country
      Interest: r[4] || "",           // E: Interest
      "Net Worth": r[5] || "Unknown", // F: Net Worth (string with $ and ,)
    }));

    console.log("Loaded rows from Google Sheet:", dummyData.length);
    initThreeScene();
  } catch (err) {
    console.error("Failed to load Google Sheet", err);
    alert("Failed to load Google Sheet. Open DevTools → Console for details.");
  }
}

// ---------------- Scene initialisation ----------------
function initThreeScene() {
  const container = document.getElementById("three-container");
  const Y_OFFSET = 120; // push everything up to avoid overlapping legend

  console.log("THREE revision:", THREE.REVISION);

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.z = 3000;

  scene = new THREE.Scene();

  // Clear any previous data
  objects.length = 0;
  targets.table.length = 0;
  targets.sphere.length = 0;
  targets.helix.length = 0;
  targets.grid.length = 0;

  // ---------- Create CSS3D tiles + TABLE layout targets ----------
  const TABLE_COLS = 20;
  const TABLE_ROWS = 10;
  const TABLE_X_SPACING = 160;
  const TABLE_Y_SPACING = 220;

  dummyData.forEach((item, i) => {
    const element = document.createElement("div");
    element.className = "element";

    // --- field mapping from sheet object ---
    const name = item.Name || item.name || "Unknown";
    const age = item.Age || item.age || "Unknown";
    const country = item.Country || item.country || "Unknown";
    const interest = item.Interest || item.interest || "";
    const photo =
      item.Photo || item.photo || "https://via.placeholder.com/80x80?text=?";

    const netWorthRaw =
      item["Net Worth"] || item.netWorth || item.net_worth || "Unknown";
    const netWorthStr = netWorthRaw;

    // Parse numeric net worth (strip $ and commas)
    let netWorthNum = parseFloat(String(netWorthRaw).replace(/[^0-9.]/g, ""));
    if (isNaN(netWorthNum)) netWorthNum = 0;

    // --- colour band based on net worth ---
    const RED = "#EF3022";
    const ORANGE = "#FDC435";
    const GREEN = "#3BAF4B";

    let borderColor = RED;
    if (netWorthNum > 200000) {
      borderColor = GREEN;
    } else if (netWorthNum > 100000) {
      borderColor = ORANGE;
    }

    // Force border + glow colour
    element.style.border = `4px solid ${borderColor}`;
    element.style.boxShadow = `0 0 18px ${borderColor}`;

    // --- tile content (photo + text) ---
    element.innerHTML = `
      <div class="card-photo">
        <img src="${photo}" alt="${name}" />
      </div>
      <div class="card-text">
        <h3>${name}</h3>
        <p>Age: ${age}</p>
        <p>Country: ${country}</p>
        <p>Net Worth: ${netWorthStr}</p>
        ${interest ? `<p>Interest: ${interest}</p>` : ""}
      </div>
    `;

    // Random starting position for animation
    const objectCSS = new THREE.CSS3DObject(element);
    objectCSS.position.x = Math.random() * 4000 - 2000;
    objectCSS.position.y = Math.random() * 4000 - 2000;
    objectCSS.position.z = Math.random() * 4000 - 2000;
    scene.add(objectCSS);

    objects.push(objectCSS);

    // ----- TABLE layout target: 20 x 10 -----
    const objectTable = new THREE.Object3D();
    const col = i % TABLE_COLS;
    const row = Math.floor(i / TABLE_COLS); // 0..9 if 200 items

    objectTable.position.x =
      (col - (TABLE_COLS / 2 - 0.5)) * TABLE_X_SPACING;
    objectTable.position.y =
      ((TABLE_ROWS / 2 - 0.5) - row) * TABLE_Y_SPACING + Y_OFFSET;
    objectTable.position.z = 0;

    targets.table.push(objectTable);
  });

  const vector = new THREE.Vector3();
  const l = objects.length;

  // ---------- SPHERE layout ----------
  for (let i = 0; i < l; i++) {
    const phi = Math.acos(-1 + (2 * i) / l);
    const theta = Math.sqrt(l * Math.PI) * phi;

    const object = new THREE.Object3D();
    object.position.setFromSphericalCoords(800, phi, theta);
    object.position.y += Y_OFFSET;

    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);

    targets.sphere.push(object);
  }

  // ---------- DOUBLE HELIX layout ----------
  for (let i = 0; i < l; i++) {
    const object = new THREE.Object3D();

    const strand = i % 2; // 0 or 1
    const indexOnStrand = Math.floor(i / 2);

    const theta =
      indexOnStrand * 0.35 + (strand === 0 ? 0 : Math.PI); // 180° phase shift
    const y = -(indexOnStrand * 120) + 600 + Y_OFFSET;

    object.position.setFromCylindricalCoords(900, theta, y);

    vector.x = object.position.x * 2;
    vector.y = object.position.y;
    vector.z = object.position.z * 2;
    object.lookAt(vector);

    targets.helix.push(object);
  }

  // ---------- GRID layout: 5 x 4 x 10 ----------
  const GRID_COLS = 5;
  const GRID_ROWS = 4;
  const GRID_DEPTH = 10; // 5 * 4 * 10 = 200 items

  const GRID_X_SPACING = 220;
  const GRID_Y_SPACING = 260;
  const GRID_Z_SPACING = 400;

  for (let i = 0; i < l; i++) {
    const object = new THREE.Object3D();

    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS) % GRID_ROWS;
    const layer = Math.floor(i / (GRID_COLS * GRID_ROWS));

    object.position.x =
      (col - (GRID_COLS / 2 - 0.5)) * GRID_X_SPACING;
    object.position.y =
      ((GRID_ROWS / 2 - 0.5) - row) * GRID_Y_SPACING + Y_OFFSET;
    object.position.z =
      (layer - (GRID_DEPTH / 2 - 0.5)) * GRID_Z_SPACING;

    targets.grid.push(object);
  }

  // ---------- Renderer & controls ----------
  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Trackball controls
  controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;
  controls.noPan = true;
  controls.minDistance = 500;
  controls.maxDistance = 6000;
  controls.staticMoving = true;
  controls.dynamicDampingFactor = 0.15;

  // Default layout: TABLE
  transform(targets.table, 2000);

  document
    .getElementById("btn-table")
    .addEventListener("click", () => transform(targets.table, 2000));
  document
    .getElementById("btn-sphere")
    .addEventListener("click", () => transform(targets.sphere, 2000));
  document
    .getElementById("btn-helix")
    .addEventListener("click", () => transform(targets.helix, 2000));
  document
    .getElementById("btn-grid")
    .addEventListener("click", () => transform(targets.grid, 2000));

  window.addEventListener("resize", onWindowResize);

  animate();
}

// ---------------- Animation helpers ----------------
function transform(targetsArray, duration) {
  TWEEN.removeAll();

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const target = targetsArray[i];
    if (!target) continue;

    new TWEEN.Tween(object.position)
      .to(
        {
          x: target.position.x,
          y: target.position.y,
          z: target.position.z,
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: target.rotation.x,
          y: target.rotation.y,
          z: target.rotation.z,
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (controls) {
    controls.handleResize();
    controls.update();
  }
}

function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();
  if (controls) controls.update();
  renderer.render(scene, camera);
}
