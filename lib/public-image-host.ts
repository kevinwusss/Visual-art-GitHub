import {BlockList,isIP} from "node:net";

const blocked=new BlockList();
for(const [address,prefix] of [
  ["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],
  ["169.254.0.0",16],["172.16.0.0",12],["192.168.0.0",16],
  ["192.0.0.0",24],["198.18.0.0",15],["224.0.0.0",4],["240.0.0.0",4]
] as const) blocked.addSubnet(address,prefix,"ipv4");
for(const [address,prefix] of [
  ["::",128],["::1",128],["fc00::",7],["fe80::",10],["ff00::",8],
  ["2001:db8::",32],["64:ff9b::",96],["2002::",16]
] as const) blocked.addSubnet(address,prefix,"ipv6");

export function isPrivateImageAddress(address:string):boolean {
  const clean=address.replace(/^\[|\]$/g,"");
  const family=isIP(clean);
  return !family || blocked.check(clean,family===6?"ipv6":"ipv4");
}

export function isAllowedImageURL(target:URL):boolean {
  return ["http:","https:"].includes(target.protocol)
    && (!target.port || ["80","443"].includes(target.port))
    && !target.username && !target.password;
}
