import * as Phaser from 'phaser';

const CRT_FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float time;
uniform vec2 resolution;
uniform float intensity;
uniform float brightness;
uniform float vignetteStrength;
uniform float scanlineStrength;
uniform float apertureStrength;

varying vec2 outTexCoord;

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 curve(vec2 uv) {
  // Barrel distortion (stronger toward corners)
  uv = (uv - 0.5) * 2.0;
  float r2 = dot(uv, uv);
  uv *= 1.0 + r2 * 0.2 * intensity;
  uv.x *= 1.0 + pow(abs(uv.y), 2.2) * 0.28;
  uv.y *= 1.0 + pow(abs(uv.x), 2.2) * 0.18;
  return uv * 0.5 + 0.5;
}

vec3 sampleColor(vec2 uv, float offset) {
  return texture2D(uMainSampler, uv + vec2(offset, 0.0)).rgb;
}

void main() {
  vec2 uv = curve(outTexCoord);

  // Outside screen area becomes black
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Slight vertical jitter/roll and occasional tearing band
  float lineJitter = (sin(time * 120.0) * 0.0005 + sin(time * 2.0) * 0.0010) * intensity;
  float tearY = fract(time * 0.07);
  float tear = smoothstep(0.0, 0.02, abs(uv.y - tearY));
  uv.y += lineJitter * (1.0 - tear);

  // Chromatic aberration
  float chroma = (0.0035 + sin(time * 0.25) * 0.0015) * (0.7 + 0.3 * intensity);
  vec3 color;
  color.r = sampleColor(uv, +chroma).r;
  color.g = sampleColor(uv, 0.0).g;
  color.b = sampleColor(uv, -chroma).b;

  // Horizontal scanlines
  float scan = 0.85 + 0.15 * sin((uv.y * resolution.y) * 3.14159);
  color *= mix(vec3(1.0), vec3(scan), clamp(scanlineStrength, 0.0, 1.0) * intensity);

  // Aperture grille (RGB triad slot mask)
  float m = mod(floor(uv.x * resolution.x), 3.0);
  float is0 = 1.0 - step(0.5, m);
  float is1 = step(0.5, m) * (1.0 - step(1.5, m));
  float is2 = step(1.5, m);
  vec3 aperture = vec3(0.6);
  aperture += vec3(0.4 * is0, 0.4 * is1, 0.4 * is2);
  color *= mix(vec3(1.0), aperture, clamp(apertureStrength, 0.0, 1.0) * intensity);

  // Vignette and corner shading to emulate tube
  float vignette = 1.0 - smoothstep(0.35, 0.98, distance(uv, vec2(0.5)));
  float cornerShade = 1.0 - pow(length(uv * 2.0 - 1.0), 1.3) * 0.2;
  float vigMix = mix(1.0, 0.95 + 0.05 * vignette, clamp(vignetteStrength, 0.0, 1.0));
  color *= max(0.95, vigMix) * max(0.9, cornerShade);

  // Film grain/noise
  float grain = rand(vec2(floor(uv.x * resolution.x), floor(uv.y * resolution.y)) + time) - 0.5;
  color += vec3(grain) * 0.08 * intensity;

  // Subtle global flicker
  color *= 0.98 + 0.02 * sin(time * 60.0);

  // Overall brightness and highlight lift so bright UI/player pops
  color *= max(0.5, brightness);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float highlightBoost = smoothstep(0.35, 0.9, luma) * (0.15 + 0.25 * intensity);
  color += color * highlightBoost;

  // Subtle contrast boost around mid-tones
  float contrast = 1.06; // ~6% more contrast
  color = (color - 0.5) * contrast + 0.5;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

export class CRTPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  public intensity: number = 1.0;
  public brightness: number = 1.15;
  public vignetteStrength: number = 0.3;
  public scanlineStrength: number = 0.35;
  public apertureStrength: number = 0.45;
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'crt-pipeline',
      fragShader: CRT_FRAGMENT_SHADER
    });
  }

  onPreRender() {
    this.set1f('time', this.game.loop.now / 1000);
    this.set2f('resolution', this.renderer.width, this.renderer.height);
    this.set1f('intensity', this.intensity);
    this.set1f('brightness', this.brightness);
    this.set1f('vignetteStrength', this.vignetteStrength);
    this.set1f('scanlineStrength', this.scanlineStrength);
    this.set1f('apertureStrength', this.apertureStrength);
  }
}
