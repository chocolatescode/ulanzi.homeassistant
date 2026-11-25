// Automatyczne ikony dla encji Home Assistanta.
// Ikony: Material Design Icons (te same co w HA), wyrenderowane jako maski w images/icons.pack.
// Ikona zależy od domeny, device_class, stanu, nazwy encji; czujniki liczbowe mają wartość na ikonie.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { Canvas } = require("./png");

const PACK = path.join(__dirname, "..", "images", "icons.pack");
let pack = null;
function loadPack() {
  if (pack) return pack;
  const buf = fs.readFileSync(PACK);
  if (buf.toString("ascii", 0, 5) !== "HAIP1") throw new Error("zły plik icons.pack");
  const jl = buf.readUInt32LE(5), idx = JSON.parse(buf.toString("utf8", 9, 9 + jl));
  pack = { buf, base: 9 + jl, idx, cache: new Map() };
  return pack;
}
function blob(off, len) {
  const p = loadPack(), k = off;
  if (!p.cache.has(k)) p.cache.set(k, zlib.inflateSync(p.buf.subarray(p.base + off, p.base + off + len)));
  return p.cache.get(k);
}
const hasIcon = (n) => !!(n && loadPack().idx.icons[n]);
function iconMask(name) {
  const p = loadPack(), e = p.idx.icons[name] || p.idx.icons["help-circle-outline"];
  return { m: blob(e[0], e[1]), w: p.idx.iconSize, h: p.idx.iconSize };
}
function glyph(ch) {
  const p = loadPack(), g = p.idx.glyphs[ch.codePointAt(0)] || p.idx.glyphs[63];
  return { m: blob(g[0], g[1]), w: g[2], adv: g[3] };
}

// --- kolory ---
const C = {
  bgTop: "#1e2442", bgBottom: "#141830",
  off: "#7a819e", na: "#565b72", text: "#ffffff", textDim: "#aab0c8",
  amber: "#ffc23d", orange: "#ff8a3d", red: "#f2615a", blue: "#4fa3ff", cyan: "#34d1c9",
  green: "#5cc46b", purple: "#a78bfa", pink: "#f472b6", value: "#9fb7e0", yellow: "#ffe066",
};

// --- pomocnicze ---
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
const num = (s) => { if (s === null || s === undefined || s === "") return NaN; const v = Number(s); return Number.isFinite(v) ? v : NaN; };
const pick = (cond, a, b) => (cond ? a : b);

// słowa w nazwie encji → ikona (dla rzeczy, których domena nie opisuje)
const NAME_RULES = [
  [/(gniazd|plug|socket|outlet|wtyczk)/, "power-socket-eu", ["switch", "input_boolean"]],
  [/\b(led|pasek|tasm|strip|lightstrip)/, "led-strip-variant", ["light", "switch", "input_boolean"]],
  [/(monitor|screenbar|lightbar)/, "monitor", ["switch", "input_boolean", "media_player"]],
  [/(zyrandol|chandelier)/, "chandelier", ["light"]],
  [/(kinkiet|sconce)/, "wall-sconce-flat", ["light"]],
  [/(sufit|ceiling|plafon)/, "ceiling-light", ["light"]],
  [/(biurk|desk)/, "desk-lamp", ["light"]],
  [/(lamp|lampk|stojac|floor)/, "lamp", ["light"]],
  [/(swiec|candle)/, "candle", ["light"]],
  [/(choink|christmas|xmas)/, "pine-tree", ["light", "switch", "input_boolean"]],
  [/(ogrod|garden|taras|terrace)/, "outdoor-lamp", ["light"]],
  [/(wentyl|fan\b|wiatrak)/, "fan", ["switch", "input_boolean"]],
  [/(projektor|projector)/, "projector", ["switch", "media_player", "input_boolean", "remote"]],
  [/(telewiz|\btv\b|television)/, "television", ["switch", "media_player", "input_boolean", "remote"]],
  [/(komputer|\bpc\b|desktop)/, "desktop-tower-monitor", ["switch", "input_boolean", "button"]],
  [/(laptop|notebook)/, "laptop", ["switch", "input_boolean", "button"]],
  [/(drukar|printer)/, "printer", ["switch", "input_boolean"]],
  [/(czajnik|kettle)/, "kettle", ["switch", "input_boolean"]],
  [/(pralk|washer|washing)/, "washing-machine", ["switch", "input_boolean", "sensor", "binary_sensor"]],
  [/(susz|dryer)/, "tumble-dryer", ["switch", "input_boolean", "sensor", "binary_sensor"]],
  [/(zmywar|dishwasher)/, "dishwasher", ["switch", "input_boolean", "sensor", "binary_sensor"]],
  [/(ekspres|kawa|coffee)/, "coffee-maker", ["switch", "input_boolean", "button"]],
  [/(lodowk|fridge|zamrazark|freezer)/, "fridge", ["switch", "input_boolean"]],
  [/(piekarnik|oven|kuchenk|stove)/, "stove", ["switch", "input_boolean"]],
  [/(mikrofal|microwave)/, "microwave", ["switch", "input_boolean"]],
  [/(router|wifi|wi-fi|access point)/, "router-wireless", ["switch", "input_boolean", "button"]],
  [/(grzejnik|kaloryfer|radiator|grzalk)/, "radiator", ["switch", "input_boolean", "climate"]],
  [/(klimatyz|air ?con|\bac\b)/, "air-conditioner", ["switch", "input_boolean", "climate"]],
  [/(oczyszcz|purifier)/, "air-purifier", ["switch", "input_boolean", "fan"]],
  [/(nawilz|humidif)/, "air-humidifier", ["switch", "input_boolean"]],
  [/(osuszacz|dehumid)/, "air-humidifier", ["switch", "input_boolean"]],
  [/(odkurzacz|vacuum)/, "robot-vacuum", ["switch", "input_boolean", "button"]],
  [/(glosnik|speaker|soundbar)/, "speaker", ["switch", "input_boolean", "media_player"]],
  [/(bojler|boiler|\bpiec|kociol)/, "water-boiler", ["switch", "input_boolean"]],
  [/(pomp|pump)/, "pump", ["switch", "input_boolean"]],
  [/(zrasz|sprinkler|podlew|nawadn|irrigat)/, "sprinkler-variant", ["switch", "input_boolean", "valve"]],
  [/(kamer|camera|cctv)/, "cctv", ["switch", "input_boolean"]],
  [/(dzwonek|doorbell)/, "doorbell", ["switch", "binary_sensor", "button", "event"]],
  [/(akwarium|aquarium)/, "fishbowl", ["switch", "light", "input_boolean"]],
  [/(konsol|xbox|playstation|\bps5\b|nintendo)/, "controller", ["switch", "media_player", "input_boolean"]],
  [/(ladowar|charger|wallbox)/, "ev-station", ["switch", "input_boolean"]],
  [/(brama|gate)/, "gate", ["switch", "button", "cover", "input_boolean"]],
  [/(garaz|garage)/, "garage", ["switch", "button", "cover", "input_boolean"]],
  [/(markiz|awning)/, "awning-outline", ["cover"]],
  [/(zaslon|firan|curtain)/, "curtains", ["cover"]],
  [/(rolet|blind|shade|zaluz)/, "roller-shade", ["cover"]],
  [/(okno|window)/, "window-closed-variant", ["switch", "input_boolean"]],
  [/(drzwi|door)/, "door", ["switch", "button", "input_boolean"]],
  [/(alarm|syren|siren)/, "bullhorn", ["switch", "input_boolean"]],
  [/(restart|reboot|uruchom ponownie)/, "restart", ["button"]],
  [/(wylacz|shutdown|power off)/, "power", ["button"]],
  [/(identify|identyf)/, "crosshairs-question", ["button"]],
  [/(spanie|sleep|noc\b|night)/, "weather-night", ["input_boolean", "switch", "scene", "script"]],
  [/(urlop|wakacj|vacation|holiday)/, "airplane", ["input_boolean", "switch"]],
  [/(gosc|guest)/, "account-multiple", ["input_boolean", "switch"]],
];

// słowa kluczowe dla encji, które z domeny/device_class dostałyby ogólną ikonę
// (ustawienia kamer, drukarek, robotów, telefonów itd.) — kolejność ma znaczenie
const GENERIC = new Set(["gauge", "information-outline", "checkbox-marked-circle", "radiobox-blank", "toggle-switch-variant", "toggle-switch-variant-off",
  "toggle-switch", "toggle-switch-off", "ray-vertex", "format-list-bulleted", "gesture-tap-button", "button-pointer", "form-textbox", "eye-check", "counter"]);
const KEYWORDS = [
  [/(backlight|podswietl|indicator)/, "led-on"],
  [/(bright\+|jasniej)/, "brightness-7"], [/(bright-|ciemniej)/, "brightness-4"],
  [/(oscillat|oscylac)/, "arrow-oscillating"],
  [/(hot\/cold|cieplo\/zimno)/, "thermometer"], [/(\bcold\b|zimn)/, "snowflake"], [/(\bwarm\b|ciepl)/, "fire"],
  [/(\block\b|blokada)/, "lock-outline"],
  [/(\ba\/b\b)/, "swap-horizontal"],
  [/(\bring\b|zadzwon|find)/, "bell-ring-outline"],
  [/(filter life|clear-filter|reset filter|filtr powietrza)/, "air-filter"],
  [/(collect.?dust|dust|kurz|odsys)/, "delete-variant"],
  [/(recharge|charging|ladowan)/, "battery-charging"],
  [/(resume|wznow)/, "play-circle-outline"],
  [/(review|przeglad)/, "eye-outline"],
  [/(distance|odleglosc)/, "signal-distance-variant"],
  [/(water level|poziom wody)/, "water"],
  [/(silent|cisz)/, "volume-off"],
  [/(shutdown|wylacz)/, "power"],
  [/(\buid\b|\bid\b)/, "identifier"],
  [/(voice)/, "account-voice"],
  [/(bezpiecznik|breaker|\bfuse)/, "fuse"],
  [/(ceiling|sufit|plafon)/, "ceiling-light"],
  [/(swiatl|oswietl|\blight\b|lampa|zarowk)/, "lightbulb"],
  [/(rolet|blind|shutter|zaluz)/, "roller-shade"],
  [/projektor|projector/, "projector"],
  [/(toner|series (bk|c|m|y)\b)/, "water"],
  [/(beben|bebna|drum)/, "cylinder"],
  [/(utrwalacz|fuser)/, "fire"],
  [/(zycie paska|belt)/, "transit-connection-horizontal"],
  [/(pf kit|tray|podajnik)/, "tray-full"],
  [/(pages|stron)/, "file-document-multiple-outline"],
  [/(\brx\b|download|pobier)/, "download"],
  [/(\btx\b|upload|wysyl)/, "upload"],
  [/ptz.*(w lewo w gore|left up)/, "arrow-top-left-bold-outline"], [/ptz.*(w prawo w gore|right up)/, "arrow-top-right-bold-outline"],
  [/ptz.*(w lewo w dol|left down)/, "arrow-bottom-left-bold-outline"], [/ptz.*(w prawo w dol|right down)/, "arrow-bottom-right-bold-outline"],
  [/ptz.*(w lewo|left)/, "arrow-left-bold-outline"], [/ptz.*(w prawo|right)/, "arrow-right-bold-outline"],
  [/ptz.*(w gore|\bup\b)/, "arrow-up-bold-outline"], [/ptz.*(w dol|down)/, "arrow-down-bold-outline"],
  [/(przybliz|zoom in)/, "magnify-plus-outline"], [/(oddal|zoom out)/, "magnify-minus-outline"],
  [/(pozycj\w* domow|home position|ustaw biezaca)/, "home-import-outline"],
  [/(zatrzymaj|\bstop\b|pause|pauza)/, "pause-circle-outline"],
  [/(preset|ptz)/, "camera-control"],
  [/(sledzeni|tracking)/, "crosshairs-gps"],
  [/(sylwetk|human|\bperson\b|osob)/, "human"],
  [/(sabotaz|tamper)/, "shield-alert-outline"],
  [/(motion|\bruch)/, "motion-sensor"],
  [/(dzien\/noc|day\/night|dzien noc)/, "theme-light-dark"],
  [/(starlight|night vision|noktowiz|podczerwien|\bir\b)/, "weather-night"],
  [/(wdr|zakres dynamiki|\bhdr\b)/, "hdr"],
  [/(stabiliz)/, "image-filter-center-focus"],
  [/(znieksztalc|obiektyw|lens)/, "camera-iris"],
  [/(przeswietl|overexpos|ekspozyc|exposure)/, "camera-iris"],
  [/(odwroc\w* obraz|flip)/, "flip-vertical"], [/(lustrz|mirror)/, "flip-horizontal"],
  [/(migotan|flicker)/, "sine-wave"],
  [/(wzmocn|gain)/, "tune-vertical"],
  [/(zamgl|anti-fog|\bfog\b)/, "weather-fog"],
  [/(redukcja szum|noise)/, "blur"],
  [/(jasnosc|brightness)/, "brightness-6"], [/(kontrast|contrast)/, "contrast-box"],
  [/(nasyceni|saturation)/, "palette"], [/(odcien|\bhue\b)/, "palette-outline"],
  [/(styl obrazu|image style)/, "image-filter-hdr"],
  [/(powiadom|push|notif)/, "bell-ring-outline"],
  [/(zrzut|snapshot)/, "camera"],
  [/(karta sd|karcie sd|kart\w* sd|sd card|pre-record)/, "sd"],
  [/(nagryw|record)/, "record-rec"],
  [/(glosnosc|glosnik|volume|speaker)/, "volume-high"],
  [/(mikrofon|microphone)/, "microphone"],
  [/(sygnal dzwiek|beep|dzwiek|audio|sound)/, "volume-high"],
  [/(blokuj|block)/, "cloud-off-outline"],
  [/(status chmury|cloud status)/, "cloud-check-outline"],
  [/(chmur|cloud|p2p|relay)/, "cloud-outline"],
  [/(firmware|oprogramowani|aktualiz)/, "update"],
  [/(czas letni|daylight)/, "sun-clock"],
  [/(ntp|zegar|clock)/, "clock-outline"],
  [/(rozdzielczosc|resolution)/, "monitor-screenshot"],
  [/(bitrate|przeplyw)/, "speedometer"],
  [/(fps|klatek|frame|gop)/, "filmstrip"],
  [/(kodek|codec|kodowani)/, "file-video-outline"],
  [/(jakosc|quality)/, "high-definition"],
  [/(strumien|stream|standard wideo|wideo|video)/, "video-outline"],
  [/(haslo|hasla|password)/, "form-textbox-password"],
  [/(telnet|debug|ssh|terminal)/, "console"],
  [/(upnp|port\b|porty)/, "lan"],
  [/(e-mail|email|telefon)/, "email-outline"],
  [/(konto|account|aplikacj)/, "account-key-outline"],
  [/(uzytkownic|users)/, "account-multiple"], [/(zalogowan|logged)/, "account-check"],
  [/(wi-?fi|signal|sygnal)/, "wifi"],
  [/(network|siec)/, "access-point-network"],
  [/(location|lokaliz)/, "crosshairs-gps"],
  [/(last request)/, "cloud-sync-outline"],
  [/(restart|reboot|ponowne uruchom)/, "restart"],
  [/(deszcz|rain)/, "weather-rainy"],
  [/(kondycj|health)/, "heart-pulse"],
  [/(kopii zapas|backup)/, "backup-restore"],
  [/(keep warm|podgrzew)/, "heat-wave"],
  [/(frytk|fryer)/, "pot-steam"],
  [/(recipe|przepis)/, "book-open-variant"],
  [/(steam|par[ay])/, "kettle-steam"],
  [/(szczotk|brush)/, "brush"],
  [/(mop)/, "water"],
  [/(lidar|collision)/, "radar"],
  [/(station|stacj)/, "home-import-outline"],
  [/(map|mapa|area|obszar|zone|strefa|path)/, "map-outline"],
  [/(clean|sprzat|sweep|boost)/, "robot-vacuum"],
  [/(sensitivity|czulosc)/, "tune"],
  [/(prog|threshold)/, "tune-vertical-variant"],
  [/(indicator)/, "led-on"],
  [/(countdown|odlicz|interwal|interval|czas trwania|duration|czas podtrzym|czas powrot|time)/, "timer-outline"],
  [/(format daty|date)/, "calendar"],
  [/(licznik|counter|counts|\bcount)/, "counter"],
  [/(settings|ustawien|config|konfigur)/, "cog-outline"],
  [/(log level|\blog)/, "text-box-outline"],
  [/(error|blad)/, "alert-circle-outline"],
  [/(wiadomosc|message)/, "message-text-outline"],
  [/(program)/, "format-list-numbered"],
  [/(speed\+|\+$)/, "plus-circle-outline"], [/(speed-|-$)/, "minus-circle-outline"],
  [/(\bpower\b|zasilan)/, "power"],
  [/(\bok\b)/, "check-circle-outline"],
  [/(tryb|mode)/, "tune-variant"],
  [/(progress|postep)/, "progress-check"],
  [/(battery|bater)/, "battery"],
  [/(mfc|printer|drukar|brother)/, "printer"],
  [/(speed|predkosc)/, "speedometer"],
  [/(plus)/, "plus-circle-outline"], [/(minus)/, "minus-circle-outline"],
  [/(status|stan|state)/, "information-outline"],
];
const WEAK = new Set(["information-outline", "tune-variant", "power", "plus-circle-outline", "minus-circle-outline", "check-circle-outline"]);
function keywordIcon(name) { for (const [re, ic] of KEYWORDS) if (re.test(name)) return ic; return ""; }
function tonerColor(name) {
  if (/(cyan|cyjan|series c\b)/.test(name)) return "#22d3ee"; if (/(magenta|series m\b)/.test(name)) return "#f472b6";
  if (/(yellow|zolt|series y\b)/.test(name)) return "#facc15"; if (/(black|czarn|series bk\b)/.test(name)) return "#cbd5e1"; return "";
}
const COVER_STATES = { open: 1, opening: 1, closing: 1 };

// cover: [ikona otwarta, ikona zamknięta]
const COVER = {
  awning: ["awning-outline", "awning-outline"], blind: ["blinds-horizontal", "blinds-horizontal-closed"],
  curtain: ["curtains", "curtains-closed"], damper: ["circle", "circle-slice-8"], door: ["door-open", "door-closed"],
  garage: ["garage-open", "garage"], gate: ["gate-open", "gate"], shade: ["roller-shade", "roller-shade-closed"],
  shutter: ["window-shutter-open", "window-shutter"], window: ["window-open", "window-closed"],
};
// binary_sensor: [ikona gdy on, gdy off, kolor on]
const BIN = {
  battery: ["battery-outline", "battery", C.red], battery_charging: ["battery-charging", "battery", C.green],
  carbon_monoxide: ["smoke-detector-alert", "smoke-detector", C.red], cold: ["snowflake", "thermometer", C.blue],
  connectivity: ["check-network-outline", "close-network-outline", C.green], door: ["door-open", "door-closed", C.orange],
  garage_door: ["garage-open", "garage", C.orange], gas: ["meter-gas", "meter-gas-outline", C.red],
  heat: ["fire", "thermometer", C.orange], light: ["brightness-7", "brightness-5", C.amber],
  lock: ["lock-open-variant", "lock", C.orange], moisture: ["water", "water-off", C.blue],
  motion: ["motion-sensor", "motion-sensor-off", C.amber], moving: ["arrow-right", "stop", C.cyan],
  occupancy: ["home-account", "home-outline", C.green], opening: ["square-outline", "square", C.orange],
  plug: ["power-plug", "power-plug-off", C.amber], power: ["power-plug", "power-plug-off", C.amber],
  presence: ["home-account", "home-outline", C.green], problem: ["alert-circle", "check-circle", C.red],
  running: ["play", "stop", C.green], safety: ["alert-circle", "check-circle", C.red],
  smoke: ["smoke-detector-variant-alert", "smoke-detector-variant", C.red], sound: ["music-note", "music-note-off", C.purple],
  tamper: ["alert-circle", "check-circle", C.red], update: ["package-up", "package", C.orange],
  vibration: ["vibrate", "crop-portrait", C.amber], window: ["window-open", "window-closed", C.orange],
};
// sensor wg device_class: [ikona, kolor]
const SENS = {
  apparent_power: ["flash", C.orange], aqi: ["air-filter", C.cyan], atmospheric_pressure: ["gauge", C.value],
  battery: ["battery", C.green], carbon_dioxide: ["molecule-co2", C.value], carbon_monoxide: ["molecule-co", C.value],
  current: ["current-ac", C.amber], data_rate: ["transmission-tower", C.cyan], data_size: ["database", C.cyan],
  date: ["calendar", C.value], distance: ["arrow-left-right", C.value], duration: ["progress-clock", C.value],
  energy: ["lightning-bolt", C.amber], energy_storage: ["car-battery", C.amber], frequency: ["sine-wave", C.value],
  gas: ["meter-gas", C.orange], humidity: ["water-percent", C.blue], illuminance: ["brightness-5", C.amber],
  irradiance: ["sun-wireless", C.amber], moisture: ["water-percent", C.blue], monetary: ["cash", C.green],
  nitrogen_dioxide: ["molecule", C.value], nitrogen_monoxide: ["molecule", C.value], nitrous_oxide: ["molecule", C.value],
  ozone: ["molecule", C.value], ph: ["ph", C.value], pm1: ["blur", C.value], pm10: ["blur", C.value], pm25: ["blur", C.value],
  power: ["flash", C.orange], power_factor: ["angle-acute", C.value], precipitation: ["weather-rainy", C.blue],
  precipitation_intensity: ["weather-pouring", C.blue], pressure: ["gauge", C.value], reactive_power: ["flash", C.orange],
  signal_strength: ["wifi", C.cyan], sound_pressure: ["ear-hearing", C.purple], speed: ["speedometer", C.value],
  sulphur_dioxide: ["molecule", C.value], temperature: ["thermometer", C.orange], timestamp: ["clock-outline", C.value],
  volatile_organic_compounds: ["molecule", C.value], volatile_organic_compounds_parts: ["molecule", C.value],
  voltage: ["sine-wave", C.amber], volume: ["car-coolant-level", C.blue], volume_storage: ["storage-tank", C.blue],
  volume_flow_rate: ["pump", C.blue], water: ["water", C.blue], weight: ["weight", C.value], wind_speed: ["weather-windy", C.value],
  wind_direction: ["compass-outline", C.value], conductivity: ["sprout-outline", C.green], enum: ["format-list-bulleted", C.value],
  area: ["texture-box", C.value], blood_glucose_concentration: ["spoon-sugar", C.value], absolute_humidity: ["water", C.blue],
};
// jednostka → device_class (gdy integracja nie podała device_class)
const UNIT_DC = [
  [/^°[CF]$|^K$/, "temperature"], [/^(W|kW|MW|mW)$/, "power"], [/^(Wh|kWh|MWh|GJ|MJ)$/, "energy"], [/^(V|mV|kV)$/, "voltage"],
  [/^(A|mA)$/, "current"], [/^(lx|lm)$/, "illuminance"], [/^(dB|dBm)$/, "signal_strength"], [/^(hPa|mbar|bar|Pa|kPa|psi|inHg|mmHg)$/, "pressure"],
  [/^ppm$/, "carbon_dioxide"], [/^(µg\/m³|μg\/m³|mg\/m³)$/, "pm25"], [/^(km\/h|m\/s|mph|kn)$/, "speed"], [/^(Hz|kHz|MHz|GHz)$/, "frequency"],
  [/^(B|kB|KB|MB|GB|TB|KiB|MiB|GiB|TiB)$/, "data_size"], [/^(bit\/s|kbit\/s|Mbit\/s|Gbit\/s|B\/s|kB\/s|MB\/s|GB\/s|KiB\/s|MiB\/s)$/, "data_rate"],
  [/^(s|ms|min|h|d)$/, "duration"], [/^(m³|L|l|mL|gal)$/, "volume"], [/^(m³\/h|L\/min|l\/min|L\/h)$/, "volume_flow_rate"],
  [/^(kg|g|lb|oz)$/, "weight"], [/^(mm|cm|m|km|mi|in|ft)$/, "distance"], [/^(mm\/h|in\/h)$/, "precipitation_intensity"],
  [/^(zł|PLN|EUR|€|USD|\$|gr)$/, "monetary"], [/^(VA|kVA)$/, "apparent_power"], [/^(var|kvar)$/, "reactive_power"],
];
const PCT_NAMES = [[/(wilgot|humid)/, "humidity"], [/(bater|battery|akumul)/, "battery"], [/(gleb|soil|moisture)/, "moisture"]];

// --- tłumaczenia stanów ---
const PL = {
  on: "wł.", off: "wył.", home: "w domu", not_home: "poza domem", open: "otwarte", closed: "zamknięte", opening: "otwiera",
  closing: "zamyka", locked: "zamknięte", unlocked: "otwarte", jammed: "zacięte", playing: "gra", paused: "pauza", idle: "bezczynny",
  standby: "czuwanie", buffering: "ładuje", unavailable: "niedostępne", unknown: "?", cleaning: "sprząta", docked: "w bazie",
  returning: "wraca", error: "błąd", heat: "grzanie", cool: "chłodzenie", auto: "auto", dry: "osuszanie", fan_only: "wentylacja",
  heat_cool: "auto", active: "aktywny", armed_away: "uzbrojony", armed_home: "uzbr. dom", armed_night: "uzbr. noc", disarmed: "rozbrojony",
  triggered: "ALARM", pending: "czeka", arming: "uzbraja", above_horizon: "dzień", below_horizon: "noc", sunny: "słońce", cloudy: "pochmurno",
  partlycloudy: "zachmurzenie", rainy: "deszcz", pouring: "ulewa", snowy: "śnieg", "snowy-rainy": "śnieg z deszczem", fog: "mgła",
  hail: "grad", lightning: "burza", "lightning-rainy": "burza", windy: "wiatr", "windy-variant": "wiatr", "clear-night": "pogodnie",
  exceptional: "uwaga", charging: "ładuje", discharging: "rozładowuje", full: "pełna", mowing: "kosi", none: "brak", low: "niski", medium: "średni", high: "wysoki",
};
const WEATHER = {
  "clear-night": "weather-night", cloudy: "weather-cloudy", exceptional: "alert-circle-outline", fog: "weather-fog", hail: "weather-hail",
  lightning: "weather-lightning", "lightning-rainy": "weather-lightning-rainy", partlycloudy: "weather-partly-cloudy", pouring: "weather-pouring",
  rainy: "weather-rainy", snowy: "weather-snowy", "snowy-rainy": "weather-snowy-rainy", sunny: "weather-sunny", windy: "weather-windy",
  "windy-variant": "weather-windy-variant",
};

function tempColor(t, unit) {
  if (unit === "°F") t = (t - 32) / 1.8;
  if (t < 0) return "#7ab8ff"; if (t < 16) return C.blue; if (t < 19) return C.cyan; if (t < 24) return C.green; if (t < 27) return C.amber; if (t < 30) return C.orange; return C.red;
}
function batteryIcon(v, charging) {
  const lvl = Math.round(Math.max(0, Math.min(100, v)) / 10) * 10;
  if (charging) return lvl >= 100 ? "battery-charging-100" : lvl <= 0 ? "battery-charging-outline" : `battery-charging-${lvl}`;
  return lvl >= 100 ? "battery" : lvl <= 0 ? "battery-outline" : `battery-${lvl}`;
}
function levelColor(v, good, warn) { return v <= warn ? C.red : v <= good ? C.amber : C.green; }

// ======================= klasyfikacja =======================
// Zwraca { icon, color, active, value?, unit?, text? }
function classify(entityId, st) {
  const domain = String(entityId || "").split(".")[0];
  const a = (st && st.attributes) || {};
  const s = st ? String(st.state) : "unavailable";
  const dc = a.device_class || "";
  const name = norm((a.friendly_name || "") + " " + entityId);
  const isOn = !["off", "closed", "locked", "not_home", "idle", "paused", "standby", "docked", "disarmed", "below_horizon", "unavailable", "unknown", "0", "none", ""].includes(s);
  const r = { icon: "", color: C.amber, active: isOn };

  // ikona ustawiona w HA (customize / integracja)
  const haIcon = typeof a.icon === "string" && a.icon.startsWith("mdi:") ? a.icon.slice(4) : "";
  const nameIcon = () => {
    // ustawienia urządzeń (np. "Kamera Salon Wykrywanie ruchu") — najpierw słowa opisujące funkcję, potem nazwa urządzenia
    if (!["light", "cover", "media_player", "climate", "fan", "vacuum", "lawn_mower", "remote", "water_heater"].includes(domain)) { const k = keywordIcon(name); if (k && !WEAK.has(k)) return k; }
    for (const [re, ic, doms] of NAME_RULES) if (doms.includes(domain) && re.test(name)) return ic;
    return "";
  };

  const numeric = (v, unit, dcx) => {
    r.value = v; r.unit = unit || ""; r.dc = dcx || "";
  };

  switch (domain) {
    case "light": {
      r.icon = nameIcon() || (isOn ? "lightbulb" : "lightbulb-outline");
      if (isOn && Array.isArray(a.rgb_color)) r.color = rgbHex(a.rgb_color); else r.color = C.amber;
      break;
    }
    case "switch": case "input_boolean": {
      const ni = nameIcon();
      if (ni) r.icon = ni;
      else if (dc === "outlet") r.icon = isOn ? "power-plug" : "power-plug-off";
      else if (domain === "input_boolean") r.icon = isOn ? "toggle-switch" : "toggle-switch-off";
      else r.icon = isOn ? "toggle-switch-variant" : "toggle-switch-variant-off";
      r.color = C.amber; break;
    }
    case "fan": r.icon = nameIcon() || (isOn ? "fan" : "fan-off"); r.color = C.cyan; break;
    case "cover": {
      const open = !!COVER_STATES[s] || (s === "open");
      const pair = COVER[dc] || null;
      const ni = nameIcon();
      if (pair) r.icon = open ? pair[0] : pair[1];
      else if (ni === "roller-shade") r.icon = open ? "roller-shade" : "roller-shade-closed";
      else if (ni === "curtains") r.icon = open ? "curtains" : "curtains-closed";
      else if (ni === "garage") r.icon = open ? "garage-open" : "garage";
      else if (ni === "gate") r.icon = open ? "gate-open" : "gate";
      else if (ni) r.icon = ni;
      else r.icon = open ? "window-shutter-open" : "window-shutter";
      if (s === "opening") r.icon = "arrow-up-box"; if (s === "closing") r.icon = "arrow-down-box";
      r.color = C.purple; r.active = open;
      const pos = num(a.current_position);
      if (pos > 0 && pos < 100) numeric(pos, "%", "position");
      break;
    }
    case "lock": {
      r.icon = { locked: "lock", unlocked: "lock-open-variant", open: "lock-open-variant", jammed: "lock-alert", locking: "lock-clock", unlocking: "lock-clock", opening: "lock-clock" }[s] || "lock";
      r.active = true; r.color = s === "jammed" ? C.red : s === "locked" ? C.green : C.orange; break;
    }
    case "climate": case "water_heater": {
      const mode = s;
      const modeIcon = { heat: "fire", cool: "snowflake", auto: "thermostat-auto", dry: "water-percent", fan_only: "fan", heat_cool: "sun-snowflake-variant", off: "thermostat" };
      r.icon = domain === "water_heater" ? (isOn ? "water-boiler" : "water-boiler-off") : (nameIcon() || modeIcon[mode] || "thermostat");
      const act = a.hvac_action;
      r.active = mode !== "off" && act !== "idle" && act !== "off";
      r.color = mode === "cool" || act === "cooling" ? C.blue : mode === "dry" ? C.blue : mode === "fan_only" ? C.cyan : C.orange;
      const cur = num(a.current_temperature);
      if (!Number.isNaN(cur)) numeric(cur, a.temperature_unit || "°C", "temperature");
      break;
    }
    case "humidifier": {
      r.icon = isOn ? "air-humidifier" : "air-humidifier-off"; r.color = C.blue;
      const h = num(a.current_humidity); if (!Number.isNaN(h)) numeric(h, "%", "humidity");
      break;
    }
    case "media_player": {
      const ni = nameIcon();
      if (ni) r.icon = ni;
      else if (dc === "tv") r.icon = isOn ? "television" : "television-off";
      else if (dc === "speaker") r.icon = isOn ? "speaker" : "speaker-off";
      else if (dc === "receiver") r.icon = isOn ? "audio-video" : "audio-video-off";
      else r.icon = isOn ? "cast" : "cast-off";
      if (s === "playing") r.icon = ni || r.icon;
      r.color = C.purple; r.active = ["on", "playing", "buffering"].includes(s); break;
    }
    case "vacuum": {
      r.icon = s === "error" ? "robot-vacuum-alert" : "robot-vacuum"; r.color = s === "error" ? C.red : C.cyan;
      r.active = ["cleaning", "returning", "error"].includes(s); r.text = PL[s] || s; break;
    }
    case "lawn_mower": r.icon = "robot-mower"; r.color = C.green; r.active = s === "mowing"; r.text = PL[s] || s; break;
    case "binary_sensor": {
      const ni = nameIcon();
      const b = BIN[dc];
      if (b) { r.icon = isOn ? b[0] : b[1]; r.color = b[2]; }
      else if (ni) { r.icon = ni; r.color = C.amber; }
      else { r.icon = isOn ? "checkbox-marked-circle" : "radiobox-blank"; r.color = C.green; }
      break;
    }
    case "sensor": case "number": case "input_number": case "counter": case "todo": case "zone": {
      const v = num(s), unit = a.unit_of_measurement || "";
      let d = dc;
      if (!d && unit === "%") { for (const [re, x] of PCT_NAMES) if (re.test(name)) { d = x; break; } }
      if (!d && unit) for (const [re, x] of UNIT_DC) if (re.test(unit)) { d = x; break; }
      const base = SENS[d];
      if (domain === "number" || domain === "input_number") { r.icon = "ray-vertex"; r.color = C.value; }
      else if (domain === "counter") { r.icon = "counter"; r.color = C.value; }
      else if (domain === "todo") { r.icon = "clipboard-list"; r.color = C.value; }
      else if (domain === "zone") { r.icon = "map-marker-radius"; r.color = C.green; }
      else if (base) { r.icon = base[0]; r.color = base[1]; }
      else { r.icon = nameIcon() || (Number.isNaN(v) ? "information-outline" : "gauge"); r.color = C.value; }
      r.active = true;
      if (!Number.isNaN(v)) {
        numeric(v, domain === "todo" || domain === "zone" ? "" : unit, d);
        if (d === "temperature") { r.color = tempColor(v, unit); r.icon = v >= 27 ? "thermometer-high" : v < 16 ? "thermometer-low" : "thermometer"; }
        if (d === "battery") { const ch = /charg|ladow/.test(name); r.icon = batteryIcon(v, false); r.color = levelColor(v, 40, 15); void ch; }
        if (d === "humidity") r.color = v < 30 || v > 70 ? C.amber : C.blue;
        if (d === "carbon_dioxide") r.color = v > 1500 ? C.red : v > 1000 ? C.orange : v > 800 ? C.amber : C.green;
        if (d === "pm25") r.color = v > 55 ? C.red : v > 35 ? C.orange : v > 12 ? C.amber : C.green;
        if (d === "pm10") r.color = v > 100 ? C.red : v > 50 ? C.orange : v > 20 ? C.amber : C.green;
        if (d === "aqi") r.color = v > 150 ? C.red : v > 100 ? C.orange : v > 50 ? C.amber : C.green;
        if (d === "signal_strength" && /dBm/.test(unit)) { const q = v >= -55 ? 4 : v >= -67 ? 3 : v >= -75 ? 2 : 1; r.icon = `wifi-strength-${q}`; r.color = q >= 3 ? C.green : q === 2 ? C.amber : C.red; }
        if ((d === "power" || d === "current") && v === 0) r.active = false;
        if (domain === "todo" || domain === "zone") r.active = v > 0;
      } else if ((d === "timestamp" || d === "date") && !["unknown", "unavailable"].includes(s)) {
        r.text = fmtTime(s, d);
      } else if (st && !["unavailable", "unknown"].includes(s)) {
        r.text = PL[s] || s.replace(/_/g, " ");
        if (/^(charging|discharging|full)$/.test(s)) { r.icon = s === "charging" ? "battery-charging" : "battery"; r.color = C.green; }
      }
      if (haIcon && hasIcon(haIcon) && d !== "battery" && d !== "temperature" && !(d === "signal_strength" && /dBm/.test(unit))) r.icon = haIcon;
      if (haIcon && d === "temperature" && /thermometer/.test(haIcon) === false && hasIcon(haIcon)) r.icon = haIcon;
      return finish(r, st, s, name, domain, haIcon && hasIcon(haIcon));
    }
    case "weather": {
      r.icon = WEATHER[s] || "weather-partly-cloudy";
      r.color = { sunny: C.amber, "clear-night": C.purple, rainy: C.blue, pouring: C.blue, snowy: "#d8e6ff", "snowy-rainy": C.blue, lightning: C.yellow, "lightning-rainy": C.yellow, exceptional: C.red }[s] || "#c6d4f0";
      r.active = true;
      const t = num(a.temperature); if (!Number.isNaN(t)) numeric(t, a.temperature_unit || "°C", "temperature");
      break;
    }
    case "sun": r.icon = s === "above_horizon" ? "white-balance-sunny" : "weather-night"; r.color = s === "above_horizon" ? C.amber : C.purple; r.active = true; break;
    case "person": case "device_tracker": {
      const home = s === "home";
      if (domain === "device_tracker" && a.source_type === "router") r.icon = home ? "lan-connect" : "lan-disconnect";
      else if (domain === "device_tracker" && a.source_type && /bluetooth/.test(a.source_type)) r.icon = home ? "bluetooth-connect" : "bluetooth";
      else r.icon = home ? "account" : "account-arrow-right";
      r.color = C.green; r.active = home;
      if (st && !["unavailable", "unknown"].includes(s)) r.text = PL[s] || s;
      break;
    }
    case "alarm_control_panel": {
      r.icon = { armed_away: "shield-lock", armed_home: "shield-home", armed_night: "shield-moon", armed_vacation: "shield-airplane", armed_custom_bypass: "security", disarmed: "shield-off", triggered: "bell-ring", pending: "shield-outline", arming: "shield-sync" }[s] || "shield";
      r.color = s === "triggered" ? C.red : s === "disarmed" ? C.off : C.green; r.active = s !== "disarmed"; break;
    }
    case "automation": r.icon = isOn ? "robot" : "robot-off"; r.color = C.cyan; break;
    case "script": r.icon = isOn ? "script-text-play" : "script-text"; r.color = C.purple; r.active = true; r.dimOff = isOn ? 0 : 1; break;
    case "scene": r.icon = nameIcon() || "palette"; r.color = C.purple; r.active = true; break;
    case "button": case "input_button": {
      r.icon = nameIcon() || { restart: "restart", update: "package-up", identify: "crosshairs-question" }[dc] || (domain === "button" ? "gesture-tap-button" : "button-pointer");
      r.color = C.cyan; r.active = true; break;
    }
    case "select": case "input_select": r.icon = "format-list-bulleted"; r.color = C.value; r.active = true; if (st) r.text = s; break;
    case "text": case "input_text": r.icon = "form-textbox"; r.color = C.value; r.active = true; if (st) r.text = s; break;
    case "date": case "input_datetime": case "datetime": case "time":
      r.icon = domain === "time" ? "clock-outline" : "calendar-clock"; r.color = C.value; r.active = true; if (st) r.text = fmtTime(s, domain); break;
    case "calendar": r.icon = isOn ? "calendar-star" : "calendar"; r.color = C.pink; if (isOn && a.message) r.text = a.message; break;
    case "camera": r.icon = s === "off" ? "video-off" : "cctv"; r.color = C.cyan; r.active = s !== "off" && s !== "unavailable"; break;
    case "siren": r.icon = isOn ? "bullhorn" : "bullhorn-outline"; r.color = C.red; break;
    case "remote": r.icon = nameIcon() || (isOn ? "remote" : "remote-off"); r.color = C.purple; break;
    case "update": r.icon = isOn ? "package-up" : "package-variant-closed-check"; r.color = isOn ? C.orange : C.green; r.active = isOn; break;
    case "timer": r.icon = s === "active" ? "timer-sand" : s === "paused" ? "timer-pause-outline" : "timer-outline"; r.color = C.amber; r.active = s === "active"; if (st) r.text = PL[s] || s; break;
    case "valve": r.icon = ["open", "opening"].includes(s) ? "valve-open" : "valve-closed"; r.color = C.blue; break;
    case "event": r.icon = nameIcon() || { doorbell: "doorbell", button: "gesture-tap-button", motion: "motion-sensor" }[dc] || "eye-check"; r.color = C.cyan; r.active = true; break;
    case "group": r.icon = "google-circles-communities"; r.color = C.amber; break;
    case "image": r.icon = "image"; r.color = C.value; r.active = true; break;
    case "notify": r.icon = "comment-alert"; r.color = C.value; r.active = true; break;
    case "tts": r.icon = "speaker-message"; r.color = C.value; r.active = true; break;
    case "stt": r.icon = "microphone-message"; r.color = C.value; r.active = true; break;
    case "conversation": r.icon = "forum-outline"; r.color = C.value; r.active = true; break;
    case "assist_satellite": r.icon = "account-voice"; r.color = C.cyan; r.active = s !== "idle"; break;
    case "wake_word": r.icon = "chat-sleep"; r.color = C.value; r.active = true; break;
    case "ai_task": r.icon = "robot-happy"; r.color = C.value; r.active = true; break;
    case "tag": r.icon = "tag-outline"; r.color = C.value; r.active = true; break;
    case "schedule": r.icon = isOn ? "calendar-clock" : "calendar-blank"; r.color = C.pink; break;
    case "plant": r.icon = s === "problem" ? "flower-tulip-outline" : "flower"; r.color = s === "problem" ? C.red : C.green; r.active = true; break;
    case "air_quality": r.icon = "air-filter"; r.color = C.cyan; r.active = true; break;
    case "alert": r.icon = isOn ? "alert" : "alert-outline"; r.color = C.red; break;
    case "mailbox": r.icon = "mailbox"; r.color = C.value; break;
    case "radio_frequency": r.icon = "radio-tower"; r.color = C.cyan; r.active = true; break;
    case "infrared": r.icon = "remote"; r.color = C.purple; r.active = true; break;
    case "proximity": r.icon = "map-marker-distance"; r.color = C.value; r.active = true; break;
    default: r.icon = nameIcon() || (isOn ? "checkbox-blank-circle" : "checkbox-blank-circle-outline"); r.color = C.amber;
  }
  if (haIcon && hasIcon(haIcon)) r.icon = haIcon;
  return finish(r, st, s, name, domain, haIcon && hasIcon(haIcon));
}

function finish(r, st, s, name, domain, haIcon) {
  if (GENERIC.has(r.icon) && !haIcon) {
    const k = keywordIcon(name);
    if (k) {
      r.icon = k;
      if (domain === "switch" || domain === "input_boolean" || domain === "binary_sensor") r.color = k === "lightbulb" ? C.amber : k === "roller-shade" ? C.purple : C.cyan;
      if (k === "water" && tonerColor(name)) r.color = tonerColor(name);
      if (k === "lightbulb" && r.active === false) r.icon = "lightbulb-outline";
    }
  }
  if (r.icon === "lightbulb" && !r.active) r.icon = "lightbulb-outline";
  if (!hasIcon(r.icon)) r.icon = "help-circle-outline";
  r.na = !st || s === "unavailable";
  if (s === "unknown" && !["button", "input_button", "scene", "event", "script", "notify", "tts", "stt", "conversation", "image"].includes(domain)) { r.active = false; delete r.text; }
  return r;
}

function rgbHex(rgb) {
  let [R, G, B] = rgb.map((x) => Math.max(0, Math.min(255, Number(x) || 0)));
  const mx = Math.max(R, G, B, 1);
  if (mx < 200) { const k = 220 / mx; R *= k; G *= k; B *= k; } // ciemne kolory rozjaśnij, żeby było je widać
  if (R > 235 && G > 235 && B > 235) return C.yellow; // biały → ciepły
  return "#" + [R, G, B].map((x) => Math.round(Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}

function fmtTime(s, kind) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = (n) => String(n).padStart(2, "0");
  if (kind === "time") return s.slice(0, 5);
  if (kind === "date") return `${p(d.getDate())}.${p(d.getMonth() + 1)}`;
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${p(d.getHours())}:${p(d.getMinutes())}`;
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtNum(v, dc) {
  const av = Math.abs(v);
  let txt;
  if (av >= 10000) {
    const SUF = ["k", "M", "G", "T", "P", "E"]; let x = v, i = -1;
    while (Math.abs(x) >= 1000 && i < SUF.length - 1) { x /= 1000; i++; }
    txt = (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, "") + SUF[i];
  } else {
    let dec = av >= 100 ? 0 : av >= 10 ? 1 : av >= 1 ? 1 : av === 0 ? 0 : 2;
    if (["humidity", "battery", "position", "moisture", "signal_strength", "carbon_dioxide", "aqi"].includes(dc)) dec = 0;
    if (Number.isInteger(v)) dec = 0;
    txt = v.toFixed(dec);
    if (txt.includes(".")) txt = txt.replace(/0+$/, "").replace(/\.$/, "");
  }
  if (txt === "-0") txt = "0";
  return txt.replace(".", ",").replace("-", "−");
}

// ======================= rysowanie =======================
const W = 196;
function textWidth(t, h) { const p = loadPack(), k = h / p.idx.glyphH; let w = 0; for (const ch of t) w += glyph(ch).adv * k; return w; }
function drawText(cv, t, x, top, h, color) {
  const p = loadPack(), k = h / p.idx.glyphH;
  for (const ch of t) {
    const g = glyph(ch);
    if (ch !== " ") cv.mask(g.m, g.w, p.idx.glyphH, x - 4 * k, top, g.w * k, h, color);
    x += g.adv * k;
  }
  return x;
}
function fitLine(t, maxW, h, minH) {
  let size = h;
  while (size > minH && textWidth(t, size) > maxW) size -= 1;
  if (textWidth(t, size) <= maxW) return [t, size];
  let s = t; while (s.length > 1 && textWidth(s + "…", size) > maxW) s = s.slice(0, -1);
  return [s.trimEnd() + "…", size];
}

function render(r, opts = {}) {
  const cv = new Canvas(W, W);
  cv.background(36, C.bgTop, C.bgBottom);
  const color = r.na ? C.na : r.active ? r.color : C.off;
  const showValue = opts.value !== false && r.value !== undefined && !r.na;
  const showText = opts.value !== false && !showValue && r.text && !r.na;
  const ic = iconMask(r.icon);
  if (showValue || showText) {
    const isz = showValue ? 84 : 92, cy = showValue ? 64 : 70;
    if (r.active && !r.na) cv.glow(W / 2, cy, 70, color, 0.28);
    cv.mask(ic.m, ic.w, ic.h, (W - isz) / 2, cy - isz / 2, isz, isz, color);
    if (showValue) {
      const n = fmtNum(r.value, r.dc), u = r.unit && r.unit.length <= 6 ? r.unit : "";
      let nh = 56, uh = 30;
      const total = () => textWidth(n, nh) + (u ? 4 + textWidth(u, uh) : 0);
      while (total() > 178 && nh > 30) { nh -= 2; uh = Math.max(20, Math.round(nh * 0.55)); }
      const ascent = loadPack().idx.ascent / loadPack().idx.glyphH;
      const top = 112, base = top + nh * ascent;
      let x = (W - total()) / 2;
      x = drawText(cv, n, x, top, nh, C.text);
      if (u) drawText(cv, u, x + 4, base - uh * ascent, uh, C.textDim);
    } else {
      const [t, sz] = fitLine(String(r.text), 178, 34, 24);
      drawText(cv, t, (W - textWidth(t, sz)) / 2, 124 + (34 - sz) / 2, sz, C.text);
    }
  } else {
    const isz = 120;
    if (r.active && !r.na) cv.glow(W / 2, W / 2, 92, color, 0.32);
    cv.mask(ic.m, ic.w, ic.h, (W - isz) / 2, (W - isz) / 2, isz, isz, color);
  }
  if (r.na) {
    const b = iconMask("alert-circle"), bs = 50;
    cv.glow(W - 44, W - 44, 30, C.bgBottom, 0.9);
    cv.mask(b.m, b.w, b.h, W - 44 - bs / 2, W - 44 - bs / 2, bs, bs, C.red);
  }
  return cv.toPNG();
}

const cache = new Map();
function iconFor(entityId, st, opts = {}) {
  const r = classify(entityId, st);
  const sig = JSON.stringify([r.icon, r.color, r.active, r.na, r.value, r.unit, r.dc, r.text, opts.value !== false]);
  let data = cache.get(sig);
  if (!data) {
    data = "data:image/png;base64," + render(r, opts).toString("base64");
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    cache.set(sig, data);
  }
  return { sig, data };
}

// raport: jak sklasyfikowano wszystkie encje (do sprawdzenia pokrycia)
function report(states) {
  const rows = [];
  for (const st of states) {
    const r = classify(st.entity_id, st), a = st.attributes || {};
    rows.push([st.entity_id, a.friendly_name || "", st.state, a.device_class || "", a.unit_of_measurement || "", a.icon || "", r.icon, r.value !== undefined ? fmtNum(r.value, r.dc) : r.text || ""]);
  }
  return rows;
}

module.exports = { classify, iconFor, render, report, fmtNum };
