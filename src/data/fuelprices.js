// Monatsmittel der Spritpreise (€/l) je Bundesland ab Januar 2018.
//
// DIESE DATEI WIRD VON scripts/update-fuelprices.mjs ÜBERSCHRIEBEN.
// Das Skript bildet aus der Tankerkönig-Historie (MTS-K-Rohdaten) je Bundesland und Monat
// das Mittel der Tagesdurchschnittspreise aller Tankstellen und schreibt dann `states` statt
// `national` + `stateOffset`.
//
// Ausgelieferter Stand: gerundete bundesweite Monatsmittel (Näherung an die veröffentlichten
// Monatsauswertungen) plus geschätzte, konstante Länderzuschläge. Für exakte Werte das
// Update-Skript ausführen (siehe README).
export const FUEL_DATA = {
  meta: {
    source: 'Tankerkönig-Historie (MTS-K), aufbereitet',
    method: 'Näherung: bundesweites Monatsmittel + geschätzter Länderzuschlag',
    approximate: true,
    stand: '2026-10',
    generated: '2026-11-14',
  },
  start: '2018-01',
  national: {
    e10: [
      1.36, 1.34, 1.33, 1.37, 1.42, 1.44, 1.43, 1.44, 1.47, 1.51, 1.46, 1.36, // 2018
      1.30, 1.31, 1.35, 1.42, 1.45, 1.40, 1.40, 1.38, 1.36, 1.38, 1.36, 1.37, // 2019
      1.38, 1.33, 1.24, 1.17, 1.15, 1.20, 1.21, 1.22, 1.21, 1.19, 1.17, 1.22, // 2020
      1.39, 1.42, 1.48, 1.48, 1.51, 1.54, 1.58, 1.59, 1.59, 1.66, 1.67, 1.62, // 2021
      1.67, 1.73, 2.07, 1.94, 2.00, 1.89, 1.78, 1.70, 1.86, 1.89, 1.81, 1.71, // 2022
      1.75, 1.79, 1.77, 1.82, 1.80, 1.78, 1.80, 1.86, 1.92, 1.83, 1.77, 1.74, // 2023
      1.74, 1.78, 1.80, 1.86, 1.83, 1.79, 1.80, 1.77, 1.70, 1.68, 1.70, 1.71, // 2024
      1.75, 1.77, 1.72, 1.70, 1.69, 1.69, 1.69, 1.69, 1.67, 1.68, 1.68, 1.66, // 2025
      1.71, 1.72, 1.73, 1.74, 1.73, 1.72, 1.73, 1.72, 1.71, 1.70, // 2026 (bis Okt.)
    ],
    diesel: [
      1.21, 1.21, 1.20, 1.23, 1.27, 1.29, 1.28, 1.29, 1.32, 1.37, 1.37, 1.27, // 2018
      1.24, 1.25, 1.27, 1.28, 1.29, 1.26, 1.27, 1.25, 1.26, 1.27, 1.25, 1.26, // 2019
      1.27, 1.22, 1.12, 1.06, 1.03, 1.05, 1.05, 1.05, 1.03, 1.02, 1.03, 1.10, // 2020
      1.27, 1.30, 1.36, 1.36, 1.39, 1.40, 1.43, 1.43, 1.45, 1.55, 1.57, 1.50, // 2021
      1.58, 1.66, 2.15, 2.05, 2.05, 2.01, 1.94, 1.98, 2.05, 2.12, 1.96, 1.82, // 2022
      1.84, 1.79, 1.72, 1.71, 1.64, 1.62, 1.65, 1.79, 1.89, 1.83, 1.75, 1.68, // 2023
      1.70, 1.73, 1.72, 1.71, 1.66, 1.65, 1.66, 1.63, 1.58, 1.60, 1.64, 1.63, // 2024
      1.68, 1.70, 1.63, 1.62, 1.59, 1.62, 1.64, 1.63, 1.62, 1.64, 1.62, 1.58, // 2025
      1.63, 1.64, 1.66, 1.65, 1.63, 1.62, 1.63, 1.63, 1.64, 1.65, // 2026 (bis Okt.)
    ],
  },
  // Geschätzte mittlere Abweichung vom Bundesmittel in €/l
  stateOffset: {
    BW: { e10: 0.005, diesel: 0.004 }, BY: { e10: 0.003, diesel: 0.002 },
    BE: { e10: -0.005, diesel: -0.006 }, BB: { e10: 0.008, diesel: 0.007 },
    HB: { e10: -0.008, diesel: -0.009 }, HH: { e10: 0.002, diesel: 0.001 },
    HE: { e10: 0.006, diesel: 0.005 }, MV: { e10: 0.012, diesel: 0.011 },
    NI: { e10: -0.003, diesel: -0.004 }, NW: { e10: -0.005, diesel: -0.004 },
    RP: { e10: 0.004, diesel: 0.003 }, SL: { e10: -0.010, diesel: -0.008 },
    SN: { e10: 0.005, diesel: 0.006 }, ST: { e10: 0.007, diesel: 0.008 },
    SH: { e10: 0.009, diesel: 0.008 }, TH: { e10: 0.006, diesel: 0.007 },
  },
};
