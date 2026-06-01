export function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  if (material && typeof material.dispose === "function") material.dispose();
}

export function disposeObject3D(object) {
  if (!object) return;

  object.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry && typeof child.geometry.dispose === "function") child.geometry.dispose();
    disposeMaterial(child.material);
  });
}

export function removeAndDispose(parent, object) {
  parent.remove(object);
  disposeObject3D(object);
}
