const VERT = `
  attribute vec2 a_pos;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_video;
  uniform vec3 u_keyColor;
  uniform float u_similarity;
  uniform float u_smoothness;
  uniform vec2 u_texelSize;

  vec2 rgbToCbCr(vec3 rgb) {
    return vec2(
      0.5 + (-0.168736 * rgb.r - 0.331264 * rgb.g + 0.5 * rgb.b),
      0.5 + (0.5 * rgb.r - 0.418688 * rgb.g - 0.081312 * rgb.b)
    );
  }

  float calcAlpha(vec3 color) {
    vec2 cbcrKey = rgbToCbCr(u_keyColor);
    vec2 cbcrPx = rgbToCbCr(color);
    float dist = distance(cbcrPx, cbcrKey);
    float greenDom = color.g - max(color.r, color.b);
    float rawGreen = smoothstep(0.05, 0.22, greenDom);
    float chromaAlpha = smoothstep(u_similarity, u_similarity + u_smoothness, dist);
    return min(chromaAlpha, 1.0 - rawGreen * (1.0 - chromaAlpha));
  }

  void main() {
    vec4 color = texture2D(u_video, v_uv);

    // Sample alpha from neighbors for smoother edges
    float a0 = calcAlpha(color.rgb);
    float a1 = calcAlpha(texture2D(u_video, v_uv + vec2( u_texelSize.x, 0.0)).rgb);
    float a2 = calcAlpha(texture2D(u_video, v_uv + vec2(-u_texelSize.x, 0.0)).rgb);
    float a3 = calcAlpha(texture2D(u_video, v_uv + vec2(0.0,  u_texelSize.y)).rgb);
    float a4 = calcAlpha(texture2D(u_video, v_uv + vec2(0.0, -u_texelSize.y)).rgb);

    // Weighted average — center pixel counts more
    float alpha = (a0 * 4.0 + a1 + a2 + a3 + a4) / 8.0;

    // Spill suppression
    vec2 cbcrKey = rgbToCbCr(u_keyColor);
    float dist = distance(rgbToCbCr(color.rgb), cbcrKey);
    float spillMask = smoothstep(u_similarity * 0.4, u_similarity + u_smoothness * 0.5, dist);
    color.g = mix(min(color.g, max(color.r, color.b) + 0.02), color.g, spillMask);

    // Premultiply for cleaner compositing
    gl_FragColor = vec4(color.rgb * alpha, alpha);
  }
`;

function createShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export function playChromaExplosion() {
  const overlay = document.getElementById('explosion-overlay');
  const video = document.getElementById('explosion-video');
  const canvas = document.getElementById('explosion-canvas');
  if (!overlay || !video || !canvas) return;

  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
  if (!gl) return;

  const vs = createShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // Fullscreen quad
  const verts = new Float32Array([
    -1, -1,  0, 1,
     1, -1,  1, 1,
    -1,  1,  0, 0,
     1,  1,  1, 0,
  ]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'a_pos');
  const aUv = gl.getAttribLocation(prog, 'a_uv');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

  // Texture
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Uniforms
  gl.uniform3f(gl.getUniformLocation(prog, 'u_keyColor'), 0.0, 1.0, 0.0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_similarity'), 0.32);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_smoothness'), 0.22);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const uTexelSize = gl.getUniformLocation(prog, 'u_texelSize');

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uTexelSize, 1.0 / canvas.width, 1.0 / canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  overlay.classList.add('active');
  video.currentTime = 0;
  video.play().catch(() => {
    overlay.classList.remove('active');
  });

  let animId;

  // Cut playback 2 seconds short
  const TRIM_END = 9;

  function render() {
    if (video.paused || video.ended || (video.duration && video.currentTime >= video.duration - TRIM_END)) {
      video.pause();
      overlay.classList.remove('active');
      cancelAnimationFrame(animId);
      return;
    }

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animId = requestAnimationFrame(render);
  }

  video.addEventListener('play', () => {
    animId = requestAnimationFrame(render);
  });

  video.addEventListener('ended', () => {
    overlay.classList.remove('active');
  });
}
