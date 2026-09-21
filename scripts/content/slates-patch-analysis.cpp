// Beam search over original 16px RGBA source rectangles. No invented colors/art.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <vector>
#ifndef SLATES_PATCH_SIDE
#define SLATES_PATCH_SIDE 16
#endif
constexpr int kPixels=SLATES_PATCH_SIDE*SLATES_PATCH_SIDE,kChannels=kPixels*3,kBytes=kPixels*4;
using Pixels=std::array<uint8_t,kChannels>;
struct Patch {std::array<uint8_t,kBytes> rgba;bool opaque;};
struct State {Pixels pixels;int error;std::vector<int> path;};
int score(const Pixels&a,const Pixels&b,int bound=2000000000){int n=0;for(int i=0;i<kChannels;i++){n+=std::abs(int(a[i])-int(b[i]));if(n>bound)return n;}return n;}
int main(int argc,char**argv){if(argc!=3)return 2;std::ifstream in(argv[1],std::ios::binary);uint32_t ns=0,nt=0;if(!in)return 3;in.read((char*)&ns,4);in.read((char*)&nt,4);if(!in||ns==0||nt==0||ns>20000||nt>20000)return 4;std::vector<Patch> patches(ns);std::vector<int> opaques,overlays,shadows;for(int i=0;i<ns;i++){in.read((char*)patches[i].rgba.data(),kBytes);bool opaque=true;for(int p=0;p<kPixels;p++)opaque&=patches[i].rgba[p*4+3]==255;patches[i].opaque=opaque;(opaque?opaques:overlays).push_back(i);}for(int id:overlays){bool black=true;for(int p=0;p<kPixels;p++)if(patches[id].rgba[p*4+3]&&(patches[id].rgba[p*4]||patches[id].rgba[p*4+1]||patches[id].rgba[p*4+2]))black=false;if(black)shadows.push_back(id);}auto readRGB=[&](){std::array<uint8_t,kBytes>a;in.read((char*)a.data(),kBytes);Pixels p;for(int j=0;j<kPixels;j++)for(int k=0;k<3;k++)p[j*3+k]=a[j*4+k];return p;};std::vector<Pixels>targets(nt),seeds(nt);for(auto&t:targets)t=readRGB();for(auto&s:seeds)s=readRGB();if(!in)return 5;std::ofstream out(argv[2]);if(!out)return 6;long long before=0,after=0;int improved=0;
for(int t=0;t<nt;t++){State seed{seeds[t],score(seeds[t],targets[t]),{-1}};before+=seed.error;std::vector<State> beam{seed};auto push=[&](State s,std::vector<State>&v){if(v.size()>=6&&s.error>=v.back().error)return;auto it=std::lower_bound(v.begin(),v.end(),s.error,[](const State&a,int e){return a.error<e;});v.insert(it,std::move(s));if(v.size()>6)v.pop_back();};
if(seed.error>kPixels*2){for(int id:opaques){Pixels p;for(int j=0;j<kPixels;j++)for(int k=0;k<3;k++)p[j*3+k]=patches[id].rgba[j*4+k];int e=score(p,targets[t],beam.size()<6?2000000000:beam.back().error);push({p,e,{id}},beam);}
// A shadow changes the best background. Evaluate background+shadow jointly,
// rather than choosing a dark but semantically wrong opaque soil tile first.
for(int sid:shadows)for(int id:opaques){Pixels p;int e=0;bool cutoff=false;for(int j=0;j<kPixels;j++){int alpha=patches[sid].rgba[j*4+3];for(int k=0;k<3;k++){int v=(patches[id].rgba[j*4+k]*(255-alpha)+127)/255;p[j*3+k]=v;e+=std::abs(v-int(targets[t][j*3+k]));}if(beam.size()>=6&&e>=beam.back().error){cutoff=true;break;}}if(!cutoff)push({p,e,{id,sid}},beam);}
for(int depth=0;depth<3&&beam.front().error>kPixels/2;depth++){auto next=beam;for(const auto&base:beam)for(int id:overlays){const auto&a=patches[id].rgba;Pixels p;int e=0;bool cutoff=false;for(int j=0;j<kPixels;j++){int alpha=a[j*4+3];for(int k=0;k<3;k++){int v=(a[j*4+k]*alpha+base.pixels[j*3+k]*(255-alpha)+127)/255;p[j*3+k]=v;e+=std::abs(v-int(targets[t][j*3+k]));}if(next.size()>=6&&e>=next.back().error){cutoff=true;break;}}if(cutoff||e>=base.error)continue;auto path=base.path;path.push_back(id);push({p,e,path},next);}if(next.front().error==beam.front().error)break;beam=std::move(next);}}
const State&best=beam.front();after+=best.error;improved+=best.error<seed.error;out<<t<<' '<<seed.error<<' '<<best.error;for(int p:best.path)out<<' '<<p;out<<'\n';if((t+1)%200==0)std::cout<<t+1<<"/"<<nt<<" improved="<<improved<<std::endl;
}std::cout<<"done "<<improved<<" patches, RGB absolute error "<<before<<" -> "<<after<<std::endl;
}
