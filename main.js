// Debug helper function
function debug(message) {
    console.log(message);
}

debug("Inicjalizacja aplikacji...");

// Utworzenie elementu overlay do efektu przejścia
const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.top = '0';
overlay.style.left = '0';
overlay.style.width = '100%';
overlay.style.height = '100%';
overlay.style.backgroundColor = '#000000';
overlay.style.zIndex = '1000';
overlay.style.pointerEvents = 'none'; // Aby nie blokować interakcji
overlay.style.transition = 'opacity 3s ease-in-out'; // Płynne przejście przez 3 sekundy
document.body.appendChild(overlay);

// Utworzenie podstawowej sceny 3D z głęboką czernią
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Konfiguracja kamery - ustawiona z prawej strony
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(7, 3, 4); // Przesunięta na prawo ale i trochę do przodu
camera.lookAt(0, 0, 0);        // Patrzy na środek sceny

// Konfiguracja renderera z lepszym antyaliasingiem
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance" // Lepsze wykorzystanie GPU
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Ograniczenie do 2x dla wydajności
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Lepsze cienie
document.body.appendChild(renderer.domElement);

// Inicjalizacja efektów postprocessingu
const composer = new THREE.EffectComposer(renderer);

// Renderowanie sceny jako pierwszy pass
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

// Dodanie FXAA (szybki antyaliasing postprocessingowy)
const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
fxaaPass.material.uniforms.resolution.value.x = 1 / (window.innerWidth * renderer.getPixelRatio());
fxaaPass.material.uniforms.resolution.value.y = 1 / (window.innerHeight * renderer.getPixelRatio());
composer.addPass(fxaaPass);

// Dodanie SMAA - lepszy antyaliasing (opcjonalnie, można zostawić sam FXAA)
const smaaPass = new THREE.SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);

// Efekt Bloom (poświata) - zoptymalizowany dla obiektu 608
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.4,    // intensywność - zwiększona dla wyraźniejszego efektu
    0.4,     // promień - lekko zwiększony dla większego rozproszenia
    0.8      // threshold (próg) - zmniejszony, aby łatwiej wyłapać obiekt 608
);
composer.addPass(bloomPass);

// Efekt winiety
const vignettePass = new THREE.ShaderPass(THREE.VignetteShader);
vignettePass.uniforms.offset.value = 0.95;  // Mniej intensywna winieta (wyższe wartości = mniejsza winieta)
vignettePass.uniforms.darkness.value = 1.6; // Intensywność winiety
composer.addPass(vignettePass);

// Efekt aberracji chromatycznej - ekstremalnie subtelny
const rgbShiftPass = new THREE.ShaderPass(THREE.RGBShiftShader);
rgbShiftPass.uniforms.amount.value = 0.0002; // Jeszcze bardziej subtelna aberracja, prawie niewidoczna
composer.addPass(rgbShiftPass);

// Ostatni pass musi renderować do ekranu
rgbShiftPass.renderToScreen = true;

// Jeszcze mniejsze oświetlenie ambient - dla mocniejszych cieni
const ambientLight = new THREE.AmbientLight(0xffffff, 0.01); 
scene.add(ambientLight);

// Ostre, kontrastowe światło punktowe z góry i lekko z prawej strony,
// aby pasowało do nowej pozycji kamery
const spotLight = new THREE.SpotLight(0xffffff, 2.0);
spotLight.position.set(3, 10, 2); // Dostosowanie do nowej perspektywy
spotLight.angle = 0.25; // Wąski kąt światła
spotLight.penumbra = 0.05; // Bardzo ostra granica
spotLight.decay = 1.5;
spotLight.distance = 40;
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 2048; // Większa rozdzielczość cieni
spotLight.shadow.mapSize.height = 2048;
spotLight.shadow.camera.near = 0.5;
spotLight.shadow.camera.far = 50;
spotLight.shadow.bias = -0.0001;
scene.add(spotLight);

// Dodanie kontrolek do kamery (obracanie, przybliżanie)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.maxDistance = 15; // Ograniczenie odległości kamery
controls.update(); // Aktualizacja kontrolek po zmianie kamery

// Obsługa zmiany rozmiaru okna
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    
    // Aktualizacja efektów przy zmianie rozmiaru okna
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    
    // Aktualizacja rozdzielczości dla FXAA
    fxaaPass.material.uniforms.resolution.value.x = 1 / (window.innerWidth * renderer.getPixelRatio());
    fxaaPass.material.uniforms.resolution.value.y = 1 / (window.innerHeight * renderer.getPixelRatio());
});

// Podłoga - ciemna, prawie niewidoczna
const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x111111, 
    roughness: 0.9,
    metalness: 0.1
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// Funkcja do zwiększenia emisji materiału
function enhanceEmissiveMaterial(material) {
    // Zachowaj oryginalny kolor emisji
    const origEmissive = material.emissive.clone();
    
    // Zwiększ jasność koloru emisji
    const brighterEmissive = new THREE.Color(
        Math.min(1.0, origEmissive.r * 1.5),
        Math.min(1.0, origEmissive.g * 1.5),
        Math.min(1.0, origEmissive.b * 1.5)
    );
    
    // Jeśli oryginalny kolor emisji był ciemny, przypisz mu jaśniejszy kolor
    if (origEmissive.r < 0.1 && origEmissive.g < 0.1 && origEmissive.b < 0.1) {
        material.emissive.set(0.8, 0.3, 0.1); // Pomarańczowo-czerwony
    } else {
        // W przeciwnym razie zwiększ jasność oryginalnego koloru
        material.emissive = brighterEmissive;
    }
    
    // Zwiększ intensywność emisji
    material.emissiveIntensity = 3.0; // Startowa wartość, będzie animowana
    
    // Zmiana innych parametrów materiału dla lepszego efektu świecenia
    material.roughness = 0.2;
    material.metalness = 0.0;
    
    debug("Zwiększono emisyjność obiektu 608");
}

// Funkcja animacji emisji obiektu 608 (pulsowanie)
function animateEmissiveObject() {
    if (!numberObject608) return;
    
    let time = 0;
    
    function updateEmissiveIntensity() {
        time += 0.01;
        
        // Jeśli obiekt ma materiały, animuj ich emisję
        if (numberObject608.material) {
            // Funkcja sinusoidalna dla płynnego pulsowania
            const pulseIntensity = 3.0 + Math.sin(time) * 1.5; // Wartość między 1.5 a 4.5
            
            // Aktualizuj pojedynczy materiał lub tablicę materiałów
            if (Array.isArray(numberObject608.material)) {
                numberObject608.material.forEach(mat => {
                    if (mat) mat.emissiveIntensity = pulseIntensity;
                });
            } else {
                numberObject608.material.emissiveIntensity = pulseIntensity;
            }
        }
        
        requestAnimationFrame(updateEmissiveIntensity);
    }
    
    updateEmissiveIntensity();
}

// Ładowanie modelu krzesła
const loader = new THREE.GLTFLoader();
const modelUrl = 'chair.glb'; // Zakładam, że masz swój model w tym miejscu

let chairModel; // Global reference to chair model
let numberObject608; // Referencja do obiektu "608"
let sceneReady = false; // Flag to track when scene is fully ready

loader.load(
    modelUrl,
    function(gltf) {
        debug("Model załadowany pomyślnie");
        chairModel = gltf.scene;
        
        // Dostosuj skalę jeśli potrzeba
        chairModel.scale.set(1, 1, 1);
        
        // Obrót modelu o 30 stopni (Math.PI/6)
        chairModel.rotation.y = Math.PI / 6; 
        
        // Włączenie cieni dla wszystkich elementów modelu i wyszukanie obiektu "608"
        chairModel.traverse(function(node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                
                // Logowanie nazw wszystkich obiektów, aby upewnić się, że znajdziemy "608"
                debug("Znaleziono obiekt: " + node.name);
                
                // Szukamy obiektu o nazwie "608"
                if (node.name === "608") {
                    debug("Znaleziono obiekt 608!");
                    numberObject608 = node;
                    
                    // Dodanie danych do obiektu 608 zamiast tworzenia osobnego punktu interaktywnego
                    node.userData = {
                        isInteractive: true,
                        message: "Posłuchaj se tego dzieciak",
                        redirectUrl: "https://www.youtube.com/watch?v=61NnCgN53No"
                    };
                    
                    // Ulepszona emisyjność dla obiektu 608
                    if (node.material) {
                        // Jeśli to jeden materiał
                        if (!Array.isArray(node.material)) {
                            enhanceEmissiveMaterial(node.material);
                        } 
                        // Jeśli to tablica materiałów
                        else {
                            node.material.forEach(mat => enhanceEmissiveMaterial(mat));
                        }
                    }
                    
                    // Rozpocznij animację emisji po krótkim czasie
                    setTimeout(() => {
                        animateEmissiveObject();
                    }, 500);
                }
                
                // Opcjonalnie - dostosuj materiały dla większego kontrastu
                if (node.material) {
                    // Zwiększ intensywność materiałów dla lepszego odzwierciedlenia światła
                    node.material.roughness = 0.3;
                    node.material.metalness = 0.1;
                }
            }
        });
        
        // Wyśrodkowanie modelu z przesunięciem w górę
        const box = new THREE.Box3().setFromObject(chairModel);
        const center = box.getCenter(new THREE.Vector3());
        // Oblicz wysokość modelu
        const height = box.max.y - box.min.y;
        // Ustaw pozycję x i z na środek, a y na 0 + połowa wysokości modelu
        chairModel.position.x = -center.x;
        chairModel.position.y = -box.min.y;  // To przesunie spód modelu na poziom y=0
        chairModel.position.z = -center.z;
        
        // Dodanie modelu do sceny
        scene.add(chairModel);
        
        // Ukrycie komunikatu ładowania
        document.getElementById('loading').style.display = 'none';
        
        // Oznacz scenę jako gotową
        sceneReady = true;
        
        // Rozpocznij efekt przejścia po krótkim opóźnieniu, aby upewnić się, 
        // że pierwsza klatka została wyrenderowana
        setTimeout(function() {
            // Rozpocznij zanikanie overlaya
            overlay.style.opacity = '0';
            
            // Usuń overlay po zakończeniu animacji
            setTimeout(function() {
                overlay.remove();
            }, 3000); // Czas równy czasowi trwania przejścia
        }, 100);
    },
    function(xhr) {
        // Postęp ładowania
        if (xhr.total > 0) {
            const percent = (xhr.loaded / xhr.total) * 100;
            document.getElementById('loading').textContent = `Ładowanie: ${Math.round(percent)}%`;
        }
    },
    function(error) {
        // Błąd ładowania
        console.error('Błąd podczas ładowania modelu:', error);
        document.getElementById('loading').textContent = 'Błąd ładowania modelu: ' + error.message;
    }
);

// Dodanie światła punktowego specjalnie dla obiektu 608
// To światło będzie widoczne tylko dla efektu bloom, a nie w scenie
function add608Light() {
    if (!numberObject608) return;
    
    // Pozycja obiektu 608
    const position608 = new THREE.Vector3();
    numberObject608.getWorldPosition(position608);
    
    // Dodaj delikatne światło punktowe przy obiekcie 608
    const light608 = new THREE.PointLight(0xff6030, 0.5, 1.0);
    light608.position.copy(position608);
    light608.position.y += 0.1; // Lekko powyżej obiektu
    scene.add(light608);
    
    // Animacja światła
    function animateLight() {
        const time = Date.now() * 0.001; // czas w sekundach
        light608.intensity = 0.5 + 0.3 * Math.sin(time * 2.0); // Pulsowanie intensywności
        
        requestAnimationFrame(animateLight);
    }
    
    animateLight();
}

// Dodanie tego światła z opóźnieniem, aby upewnić się że obiekt 608 jest załadowany
setTimeout(() => {
    add608Light();
}, 1000);

// Obsługa kliknięć myszy i dotknięć na ekranie
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function handleInteraction(event) {
    debug("Wykryto interakcję");
    // Prevent default for touch events
    event.preventDefault();
    
    // Get correct coordinates depending on event type
    let clientX, clientY;
    
    if (event.type === 'touchstart' || event.type === 'touchend') {
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }
    
    // Calculate normalized coordinates
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
    // Cast a ray from camera through mouse/touch position
    raycaster.setFromCamera(mouse, camera);
    
    // Sprawdzamy przecięcie tylko jeśli model krzesła został załadowany
    if (chairModel) {
        // Check for intersections with chair model and its children
        const intersects = raycaster.intersectObject(chairModel, true);
        
        if (intersects.length > 0) {
            debug("Trafiono w obiekt: " + (intersects[0].object.name || "bez nazwy"));
            
            // Get the object that was intersected
            let selectedObject = intersects[0].object;
            
            // Sprawdź, czy kliknięto w obiekt interaktywny
            if (selectedObject.userData && selectedObject.userData.isInteractive) {
                debug("Aktywowano interaktywny obiekt");
                
                // Użyj standardowego alertu przeglądarki
                alert(selectedObject.userData.message);
                
                // Po zamknięciu alertu, przekieruj od razu na URL
                if (selectedObject.userData.redirectUrl) {
                    window.location.href = selectedObject.userData.redirectUrl;
                }
            }
        }
    }
}

// Dodanie obsługi zdarzeń dla myszy i dotyku
renderer.domElement.addEventListener('click', handleInteraction);
renderer.domElement.addEventListener('touchend', handleInteraction);

// Sprawdzenie typu urządzenia
debug("Urządzenie mobilne: " + (('ontouchstart' in window) ? "TAK" : "NIE"));

// Funkcja animacji
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Użyj composera zamiast renderer.render
    composer.render();
}

animate();
