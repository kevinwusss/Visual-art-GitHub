import test from 'node:test';
import assert from 'node:assert/strict';
import {isPrivateImageAddress,isAllowedImageURL} from '../lib/public-image-host.ts';

test('rejects private and IPv4-mapped private destinations',()=>{
  for(const host of ['127.0.0.1','10.1.2.3','172.16.4.1','192.168.1.1','169.254.169.254','100.64.0.1','::1','::','fe90::1','fc00::1','::ffff:172.16.4.1','::ffff:7f00:1','[::ffff:a00:1]','not-an-ip']) {
    assert.equal(isPrivateImageAddress(host),true,host);
  }
});
test('allows public image addresses',()=>{
  for(const host of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111']) assert.equal(isPrivateImageAddress(host),false,host);
});
test('rejects credentials, unexpected ports, and non-HTTP schemes',()=>{
  for(const url of ['file:///etc/passwd','ftp://example.com/a.jpg','https://user:pass@example.com/a.jpg','https://example.com:8080/a.jpg']) assert.equal(isAllowedImageURL(new URL(url)),false,url);
  assert.equal(isAllowedImageURL(new URL('https://example.com/a.webp')),true);
});
