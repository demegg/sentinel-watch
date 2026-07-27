"use client";

import CrisisMap from "./CrisisMap";

export default function MapLoader() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <CrisisMap />
    </div>
  );
}
