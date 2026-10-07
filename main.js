// CS405 · Lab 1 — TODO 5 + TODO 6
// Square + correct aspect ratio + follows the mouse

const canvas = document.querySelector('canvas');

if (!navigator.gpu) {
  throw new Error('WebGPU not available');
}

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const ctx = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();

ctx.configure({
  device,
  format,
  alphaMode: 'opaque'
});

console.log('WebGPU ready:', format);


// ------------------------------------------------------------
// SHADER
// ------------------------------------------------------------

const SHADER = `
  struct U {
    time: f32,
    aspect: f32,
    mouse: vec2f
  };

  @group(0) @binding(0)
  var<uniform> u: U;

  struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) colour: vec4f
  };


  @vertex
  fn vs(@builtin(vertex_index) i: u32) -> VSOut {

    // Square = 2 triangles = 6 vertices
    var p = array<vec2f, 6>(
      // Triangle 1
      vec2f(-0.3,  0.3),
      vec2f(-0.3, -0.3),
      vec2f( 0.3, -0.3),

      // Triangle 2
      vec2f(-0.3,  0.3),
      vec2f( 0.3, -0.3),
      vec2f( 0.3,  0.3)
    );


    // Colours for each vertex
    var c = array<vec3f, 6>(
      vec3f(1.0, 0.0, 0.0),
      vec3f(0.0, 1.0, 0.0),
      vec3f(0.0, 0.0, 1.0),

      vec3f(1.0, 0.0, 0.0),
      vec3f(0.0, 0.0, 1.0),
      vec3f(1.0, 1.0, 0.0)
    );


   let a = u.time;

    let R = mat2x2f(
      cos(a),  sin(a),
    -sin(a),  cos(a)
    );

    var q = R * p[i];

    q.x = q.x / u.aspect;
    q = q + u.mouse;


    var out: VSOut;

    out.pos = vec4f(q, 0.0, 1.0);
    out.colour = vec4f(c[i], 1.0);

    return out;
  }


  @fragment
  fn fs(in: VSOut) -> @location(0) vec4f {
    return in.colour;
  }
`;


// ------------------------------------------------------------
// SHADER MODULE
// ------------------------------------------------------------

const module = device.createShaderModule({
  code: SHADER
});


// ------------------------------------------------------------
// RENDER PIPELINE
// ------------------------------------------------------------

const pipeline = device.createRenderPipeline({
  layout: 'auto',

  vertex: {
    module,
    entryPoint: 'vs'
  },

  fragment: {
    module,
    entryPoint: 'fs',
    targets: [
      {
        format
      }
    ]
  }
});


// ------------------------------------------------------------
// UNIFORM BUFFER
// ------------------------------------------------------------

const ubuf = device.createBuffer({
  size: 16,

  usage:
    GPUBufferUsage.UNIFORM |
    GPUBufferUsage.COPY_DST
});


// ------------------------------------------------------------
// BIND GROUP
// ------------------------------------------------------------

const bind = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),

  entries: [
    {
      binding: 0,
      resource: {
        buffer: ubuf
      }
    }
  ]
});


// ------------------------------------------------------------
// TIME
// ------------------------------------------------------------

const t0 = performance.now();


// ------------------------------------------------------------
// RESIZE
// ------------------------------------------------------------

function resize() {

  const dpr = Math.min(
    2,
    window.devicePixelRatio || 1
  );

  const r = canvas.getBoundingClientRect();

  canvas.width = Math.round(
    r.width * dpr
  );

  canvas.height = Math.round(
    r.height * dpr
  );
}


window.addEventListener(
  'resize',
  resize
);

resize();


// ------------------------------------------------------------
// MOUSE
// ------------------------------------------------------------

let mouseX = 0;
let mouseY = 0;


canvas.addEventListener(
  'mousemove',
  (e) => {

    const r =
      canvas.getBoundingClientRect();


    mouseX =
      ((e.clientX - r.left)
      / r.width) * 2 - 1;


    mouseY =
      -(
        ((e.clientY - r.top)
        / r.height) * 2 - 1
      );
  }
);


// ------------------------------------------------------------
// FRAME / ANIMATION LOOP
// ------------------------------------------------------------

function frame() {

  // Time in seconds
  const t =
    (performance.now() - t0)
    * 0.001;


  // Aspect ratio
  const aspect =
    canvas.width /
    canvas.height;


  // Send:
  // time
  // aspect ratio
  // mouse x
  // mouse y

  device.queue.writeBuffer(
    ubuf,
    0,
    new Float32Array([
      t,
      aspect,
      mouseX,
      mouseY
    ])
  );


  // Create command encoder
  const enc =
    device.createCommandEncoder();


  // Render pass
  const pass =
    enc.beginRenderPass({

      colorAttachments: [
        {
          view:
            ctx
              .getCurrentTexture()
              .createView(),

          clearValue: {
            r: 0.19,
            g: 0.2,
            b: 0.6,
            a: 1
          },

          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });


  // Use pipeline
  pass.setPipeline(
    pipeline
  );


  // Use uniform data
  pass.setBindGroup(
    0,
    bind
  );


  // Draw 6 vertices
  // 2 triangles = 1 square
  pass.draw(6);


  // End render pass
  pass.end();


  // Send commands to GPU
  device.queue.submit([
    enc.finish()
  ]);


  // Next frame
  requestAnimationFrame(
    frame
  );
}


// Start animation
frame();