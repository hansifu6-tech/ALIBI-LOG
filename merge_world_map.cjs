/**
 * Merge china.json provinces into worldZH.json
 * 
 * Strategy:
 * 1. Remove the existing "中国" feature from worldZH.json
 * 2. Merge ALL province polygons from china.json into one MultiPolygon "中国" feature
 * 3. This guarantees the China borders, Taiwan, 九段线 etc. all come from the trusted china.json
 * 4. Write to world.json (final output)
 */
const fs = require('fs');
const path = require('path');

const mapsDir = path.join(__dirname, 'public', 'maps');

const world = JSON.parse(fs.readFileSync(path.join(mapsDir, 'worldZH.json'), 'utf8'));
const china = JSON.parse(fs.readFileSync(path.join(mapsDir, 'china.json'), 'utf8'));

console.log('World features before:', world.features.length);

// Step 1: Remove existing China feature
const chinaIdx = world.features.findIndex(f => f.properties.name === '中国');
if (chinaIdx >= 0) {
  console.log('Removing existing 中国 feature at index', chinaIdx);
  world.features.splice(chinaIdx, 1);
} else {
  console.log('No existing 中国 feature found');
}

// Also remove any Taiwan/Hong Kong/Macau that might be separate features
const removeNames = ['台湾', 'Taiwan', '香港', 'Hong Kong', '澳门', 'Macau'];
world.features = world.features.filter(f => {
  const name = (f.properties.name || '').trim();
  const shouldRemove = removeNames.some(rn => name === rn || name.includes(rn));
  if (shouldRemove) console.log('Removing separate feature:', name);
  return !shouldRemove;
});

// Step 2: Collect all coordinates from china.json provinces into one MultiPolygon
const allPolygons = [];

china.features.forEach(f => {
  if (!f.geometry) return;
  
  if (f.geometry.type === 'Polygon') {
    allPolygons.push(f.geometry.coordinates);
  } else if (f.geometry.type === 'MultiPolygon') {
    f.geometry.coordinates.forEach(poly => {
      allPolygons.push(poly);
    });
  }
  
  console.log(`  Province: ${f.properties.name} (${f.geometry.type}, ${f.geometry.type === 'Polygon' ? 1 : f.geometry.coordinates.length} polygon(s))`);
});

console.log('Total polygon parts from china.json:', allPolygons.length);

// Step 3: Create merged China feature
const mergedChina = {
  type: 'Feature',
  properties: {
    name: '中国',
    childNum: china.features.length
  },
  geometry: {
    type: 'MultiPolygon',
    coordinates: allPolygons
  }
};

// Step 4: Insert at position 0 (or wherever)
world.features.unshift(mergedChina);

console.log('World features after:', world.features.length);

// Step 5: Write output
const outputPath = path.join(mapsDir, 'world.json');
fs.writeFileSync(outputPath, JSON.stringify(world), 'utf8');

const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
console.log(`Written to ${outputPath} (${sizeMB} MB)`);
console.log('Done!');
