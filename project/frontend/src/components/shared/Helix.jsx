// Chrome DNA double helix, ray-marched live in WebGL (no libraries).
// Pauses when off-screen, lowers its resolution on slow machines, and stands still for reduced motion.
import { useEffect, useRef } from 'react';

const GL_COMMON = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uBeat; uniform vec2 uMouse;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}
float sdRoundCone(vec3 p,float r1,float r2,float h){vec2 q=vec2(length(p.xz),p.y);float b=(r1-r2)/h;float a=sqrt(1.-b*b);float k=dot(q,vec2(-b,a));if(k<0.)return length(q)-r1;if(k>a*h)return length(q-vec2(0.,h))-r2;return dot(q,vec2(a,b))-r1;}
vec3 env(vec3 rd){
  float y=rd.y;
  vec3 c=vec3(.95,.955,.965);
  c*=mix(.2,1.,smoothstep(-.7,-.02,y));
  c*=1.-.75*exp(-y*y*260.);
  float b1=rd.x+.42; c*=1.-.92*(smoothstep(.0,.03,b1)-smoothstep(.16,.19,b1))*smoothstep(-.5,.2,y);
  float b2=rd.x-.3; c*=1.-.85*(smoothstep(.0,.03,b2)-smoothstep(.1,.13,b2));
  c=mix(c,vec3(.03,.035,.045),smoothstep(.15,.85,rd.z)*.88);
  c+=vec3(1.)*smoothstep(.93,.975,dot(rd,normalize(vec3(-.55,.7,.45))))*1.6;
  c+=vec3(1.)*smoothstep(.96,.99,dot(rd,normalize(vec3(.65,.4,.6))))*1.3;
  return c;
}`;
const GL_MAIN = `
vec3 nor(vec3 p){vec2 e=vec2(.0012,-.0012);return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y*1.0);
  vec3 ro=vec3(0.,0.,CAMZ); vec3 rd=normalize(vec3(uv,-1.7));
  float t=0.; vec2 h=vec2(1.); float glow=0.; bool hit=false;
  for(int i=0;i<90;i++){h=map(ro+rd*t);glow+=.012/(1.+h.x*h.x*90.);if(h.x<.0015){hit=true;break;}t+=h.x*.8;if(t>14.)break;}
  vec3 col=vec3(0.); float a=0.;
  if(hit){
    vec3 p=ro+rd*t; vec3 n=nor(p); vec3 r=reflect(rd,n);
    float fr=pow(1.-max(dot(n,-rd),0.),3.);
    vec3 chrome=env(r)*TINT;
    col=chrome*(.92+.15*fr);
    col+=vec3(.08,.03,.1)*fr*sin(dot(n,vec3(3.,2.,1.))+1.)*.5;
    if(h.y>.5){col*=.82;}
    float ao=clamp(map(p+n*.12).x/.12,0.,1.); col*=.5+.5*ao;
    a=1.;
  }
  
  col=col/(1.+col*.12); col=pow(col,vec3(.4545));
  gl_FragColor=vec4(col,a);
}`;
const DNA = `
vec3 bp(float id,float s){float a=id*.5+uTime*.32;return vec3(cos(a)*.66*s,id*.24,sin(a)*.66*s);}
vec2 map(vec3 p){
  p.x-=HX;
  p.xy*=rot(TILT+uMouse.x*.05);
  p.yz*=rot(.12+uMouse.y*.08);
  float id0=floor(p.y/.24+.5);
  float d=1e9; float m=0.;
  for(int k=-1;k<=1;k++){
    float id=clamp(id0+float(k),-22.,22.);
    vec3 a=bp(id,1.),b=bp(id,-1.),a2=bp(id+1.,1.),b2=bp(id+1.,-1.);
    vec3 sa=a; sa.y*=1.; 
    vec3 am=bp(id+.5,1.),bm=bp(id+.5,-1.);
    float bb=min(min(sdCap(p,a,am,.1),sdCap(p,am,a2,.1)),min(sdCap(p,b,bm,.1),sdCap(p,bm,b2,.1)));
    float r=sdCap(p,a*.9,b*.9,.042);
    float dd=smin(bb,r,.05);
    if(dd<d){d=dd;m=(r<bb-.01)?1.:0.;}
  }
  return vec2(d,m);
}`;

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

export default function Helix({ camz = 5.0, tilt = -0.3, hx = 0, scale = 0.85, className = '', style }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!gl) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const src = `${GL_COMMON}
#define CAMZ ${camz.toFixed(2)}
#define HX ${hx.toFixed(2)}
#define TINT vec3(.97,.975,.985)
#define TILT ${tilt.toFixed(2)}
${DNA}${GL_MAIN}`;
    const compile = (type, code) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[Helix] shader error', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const v = compile(gl.VERTEX_SHADER, VERT);
    const f = compile(gl.FRAGMENT_SHADER, src);
    if (!v || !f) return undefined;
    const prog = gl.createProgram();
    gl.attachShader(prog, v);
    gl.attachShader(prog, f);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);
    const U = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      beat: gl.getUniformLocation(prog, 'uBeat'),
      mouse: gl.getUniformLocation(prog, 'uMouse'),
    };

    let q = scale;
    let w = 0;
    let h = 0;
    let slow = 0;
    let last = performance.now();
    let raf = 0;
    let visible = true;
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const frame = (now) => {
      raf = 0;
      if (!visible) return;
      const dt = now - last;
      last = now;
      if (dt > 50 && dt < 400) {
        slow += 1;
        if (slow > 15 && q > 0.32) {
          q *= 0.85;
          slow = 0;
          w = 0;
        }
      } else slow = Math.max(0, slow - 1);
      const r = canvas.getBoundingClientRect();
      const nw = Math.max(1, Math.floor(r.width * q));
      const nh = Math.max(1, Math.floor(r.height * q));
      if (nw !== w || nh !== h) {
        canvas.width = nw;
        canvas.height = nh;
        w = nw;
        h = nh;
        gl.viewport(0, 0, w, h);
      }
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.res, w, h);
      gl.uniform1f(U.time, reduce ? 4 : now / 1000);
      gl.uniform1f(U.beat, 0);
      gl.uniform2f(U.mouse, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
    });
    io.observe(canvas);
    start();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      // Do not force-lose the context: React Strict Mode re-runs this effect on the same canvas.
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [camz, tilt, hx, scale]);

  return <canvas ref={ref} className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', ...style }} aria-hidden="true" />;
}
