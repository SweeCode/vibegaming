import * as Phaser from 'phaser';

const CRT_FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float time;
uniform vec2 resolution;

varying vec2 outTexCoord;

vec2 curve(vec2 uv) {
  uv = (uv - 0.5) * 2.0;
  uv.x *= 1.0 + pow(abs(uv.y), 2.2) * 0.28;
  uv.y *= 1.0 + pow(abs(uv.x), 2.2) * 0.18;
  return uv * 0.5 + 0.5;
}

float random(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 sampleColor(vec2 uv, float offset) {
  return texture2D(uMainSampler, uv + vec2(offset, 0.0)).rgb;
}

void main() {
  vec2 uv = curve(outTexCoord);

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float chromaAmount = 0.0045 + sin(time * 0.25) * 0.0015;
  vec3 color;
  color.r = sampleColor(uv, chromaAmount).r;
  color.g = sampleColor(uv, 0.0).g;
  color.b = sampleColor(uv, -chromaAmount).b;

  float scan = sin((uv.y + time * 0.45) * resolution.y * 1.5) * 0.08;
  float mask = 0.92 + sin(uv.y * resolution.y * 3.14159) * 0.06;
  float shadow = 1.0 - pow(length(uv * 2.0 - 1.0), 1.9) * 0.6;
  float vignette = 1.0 - smoothstep(0.38, 0.95, distance(uv, vec2(0.5)));
  vignette = mix(0.35, 1.0, vignette);

  float grain = random(vec2(uv.x * resolution.x, uv.y * resolution.y) + time) - 0.5;
  grain *= 0.12;

  color = color * (shadow * vignette * mask) - scan;
  color += vec3(grain);

  float frameGlow = 0.03 * sin(time * 0.6);
  color += frameGlow;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

export class CRTPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
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
  }
}
