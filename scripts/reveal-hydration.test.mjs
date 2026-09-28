import './register-ts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {renderToString} from 'react-dom/server';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
globalThis.window=dom.window;
globalThis.document=dom.window.document;
globalThis.HTMLElement=dom.window.HTMLElement;
globalThis.SVGElement=dom.window.SVGElement;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
const observers=[];
globalThis.IntersectionObserver=class {
  nodes=new Set();
  constructor(callback){this.callback=callback;observers.push(this);}
  observe(node){this.nodes.add(node);}
  unobserve(node){this.nodes.delete(node);}
  disconnect(){this.nodes.clear();}
  fire(){this.callback([...this.nodes].map(target=>({target,isIntersecting:true})));}
};
const {hydrateRoot}=await import('react-dom/client');
const {Reveal,StaggerItem}=await import('../components/motion.tsx');

test('early hydration never mutates a later SSR boundary; React owns reveal classes',async()=>{
  const errors=[];
  const previous=console.error;
  console.error=(...args)=>errors.push(args.join(' '));
  const roots=[];
  try {
    for(const Component of [Reveal,StaggerItem]) {
      const a=document.createElement('div'), b=document.createElement('div');
      const tree=React.createElement(Component,{className:'styling-desk'},'Content');
      a.innerHTML=b.innerHTML=renderToString(tree);
      document.body.append(a,b);
      const pristine=b.innerHTML;

      assert.equal(a.querySelector('.is-revealed'),null);
      let first;
      await act(async()=>{first=hydrateRoot(a,tree);});roots.push(first);
      await act(async()=>{observers.forEach(o=>o.fire());});
      assert.ok(a.querySelector('.is-revealed'));
      assert.equal(b.innerHTML,pristine,'unhydrated sibling must remain untouched');
      let second;
      await act(async()=>{second=hydrateRoot(b,tree);});roots.push(second);
      await act(async()=>{observers.forEach(o=>o.fire());});
      assert.ok(b.querySelector('.is-revealed'));
      await act(async()=>{first.render(React.createElement(Component,{className:'updated'},'Changed'));});
      assert.ok(a.querySelector('.updated.is-revealed'),'rerenders retain animation state');
    }
    assert.deepEqual(errors,[]);
  } finally {
    await act(async()=>roots.forEach(root=>root.unmount()));
    console.error=previous;
  }
  assert.ok(observers.every(observer=>observer.nodes.size===0));
});

