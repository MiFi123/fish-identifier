const assert = require("node:assert/strict");
const { calculateCatchStatistics, groupByWater, summarizeWater } = require("../public/catch-statistics.js");

const catches = [
  { speciesName: "Hecht", caughtDate: "2026-09-03", lengthCm: 80, weightGrams: 4000, waterName: "See" },
  { speciesName: "Hecht", caughtDate: "2026-08-10", lengthCm: 60, weightKg: 3.002, waterName: "See" },
  { speciesName: "Döbel", caughtDate: "2026-07-10", waterName: "Fluss" },
];
let stats = calculateCatchStatistics([], new Date("2026-09-15"));
assert.equal(stats.total, 0); assert.equal(stats.months.length, 6); assert.equal(stats.topWaters.length, 0);
stats = calculateCatchStatistics(catches, new Date("2026-09-15"));
assert.equal(stats.total, 3); assert.equal(stats.speciesCount, 2); assert.equal(stats.totalWeightGrams, 7002);
assert.equal(Math.round(stats.averageWeightGrams), 3501); assert.equal(stats.averageLengthCm, 70);
assert.equal(stats.longest.item.speciesName, "Hecht"); assert.equal(stats.heaviest.value, 4000);
assert.equal(stats.topSpecies[0].name, "Hecht"); assert.equal(stats.topWaters[0].name, "See");
assert.equal(stats.months.find((month) => month.key === "2026-09").count, 1);
const grouped = groupByWater([
  { speciesName:"Hecht", waterId:"1", waterNameSnapshot:"Iller" }, { speciesName:"Barsch", waterId:"2", waterNameSnapshot:"Iller" },
  { speciesName:"Hecht", waterName:"Iller" }, { speciesName:"Hecht", waterName:" iller " }, { speciesName:"Barsch", waterName:"ILLER" },
]);
assert.equal(grouped.length, 3, "Gleiche Namen mit verschiedenen IDs und Legacy-Gruppe bleiben getrennt");
assert.equal(grouped.find(x=>x.key==="legacy:iller").count, 3, "Legacy-Namen werden normalisiert");
assert.equal(summarizeWater(catches).topSpecies.name, "Hecht");
console.log("Fangbuch-Statistik-Tests erfolgreich.");
