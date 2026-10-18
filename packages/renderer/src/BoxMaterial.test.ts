// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BoxMaterial } from './BoxMaterial.js';

describe('BoxMaterial', () => {
  it('starts as coated card', () => {
    const material = new BoxMaterial();
    expect(material.material.roughness).toBe(0.6);
    expect(material.material.bumpScale).toBe(0.9);
  });

  it('makes a tin glossier and smoother than card, and switches back', () => {
    const material = new BoxMaterial();

    material.setFinish('tin');
    expect(material.material.roughness).toBe(0.34);
    expect(material.material.bumpScale).toBe(0.4);

    material.setFinish('card');
    expect(material.material.roughness).toBe(0.6);
    expect(material.material.bumpScale).toBe(0.9);
  });
});
