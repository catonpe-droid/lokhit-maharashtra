#!/usr/bin/env python3
"""Build compact Maharashtra 36-district visual GeoJSON for MLVM dashboard.
Source: Hari31416/india-geojson-assets; its display version includes 36
districts and is used solely for a visual map, not legal boundaries.
No personally identifiable information is handled here.
"""
import gzip
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
TARGET = Path(__file__).resolve().with_name("map.json")
URL = ("https://raw.githubusercontent.com/Hari31416/india-geojson-assets/main/"
       "display/maharashtra-districts/"
       "709c71484968215904cfbcd26b39926c93162999ba1507579f2e84f26379292b.geojson.gz")

def simplify(points, epsilon=0.009):
    if len(points) <= 5:
        return points
    def dist(p,a,b):
        dx=b[0]-a[0];dy=b[1]-a[1]
        if dx*dx+dy*dy<1e-16:return ((p[0]-a[0])**2+(p[1]-a[1])**2)**.5
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
        return ((p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2)**.5
    def rdp(arr):
        if len(arr)<=2:return arr
        m,idx=-1,0
        for i in range(1,len(arr)-1):
            d=dist(arr[i],arr[0],arr[-1])
            if d>m:m,idx=d,i
        return rdp(arr[:idx+1])[:-1]+rdp(arr[idx:]) if m>epsilon else [arr[0],arr[-1]]
    a=rdp(points)
    if len(a)<4:a=points[::max(1,len(points)//12)] + [points[0]]
    if a[-1]!=a[0]:a.append(a[0])
    return [[round(p[0],5),round(p[1],5)] for p in a]

def clean_geometry(geo):
    typ=geo["type"];coords=geo["coordinates"]
    if typ=="Polygon":
        return {"type":typ,"coordinates":[simplify(r) for r in coords]}
    if typ=="MultiPolygon":
        return {"type":typ,"coordinates":[[simplify(r) for r in poly] for poly in coords]}
    raise ValueError("Unexpected geometry: "+str(typ))

def main():
    request=Request(URL,headers={"User-Agent":"MLVM Dashboard static map publisher"})
    with urlopen(request,timeout=35) as response:
        payload=response.read()
    source=json.loads(gzip.decompress(payload).decode("utf8"))
    features=source.get("features",[])
    if len(features)!=36:
        raise RuntimeError(f"Expected 36 Maharashtra districts; got {len(features)}")
    output=[]
    for f in features:
        name=f.get("properties",{}).get("name") or f.get("properties",{}).get("dtname")
        if not name:raise RuntimeError("District name missing")
        output.append({"type":"Feature","properties":{"name":name},
                       "geometry":clean_geometry(f["geometry"])})
    TARGET.parent.mkdir(parents=True,exist_ok=True)
    TARGET.write_text(json.dumps({"type":"FeatureCollection","features":output},
                                 ensure_ascii=False,separators=(",",":")),encoding="utf8")
    print("MLVM dashboard Maharashtra map:",len(output),"districts,",TARGET.stat().st_size,"bytes")
if __name__=="__main__":
    main()
