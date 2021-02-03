/**
 * A simple class meant for easy generation AND deletion of networks
 *
 *
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class Edges {
    nid: number;
    p1: number[];
    p2: number[];
    ks: number[];
    total: number;
    constructor() {
        this.total = 0;
        this.nid = 0;
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
    }
    addEdge(id1: number, id2: number, k: number =1) {
        if (id1 < id2) {
            this.p1.push(id1);
            this.p2.push(id2);
            this.ks.push(k);
            this.total += 1;
        } else if (id2 > id1) {
            this.p1.push(id2);
            this.p2.push(id1);
            this.ks.push(k);
            this.total += 1;
        }
    }
    ;
    removeEdge(id1: number, id2: number){
        if (id1 == id2) return;
        for(let i = 0; i < this.total; i++){
            if((this.p1[i] == id1 && this.p2[i] == id2) || (this.p1[i] == id2 && this.p2[i] == id1)){
                this.p1.splice(i, 1);
                this.p2.splice(i, 1);
                this.ks.splice(i, 1);
                this.total -= 1;
                break;
            }
        }
    };
    clearAll(){
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
        this.total = 0;
    };
}


class Network {
    particles: number[];
    nid: number;
    reducedEdges: Edges;
    masses: number[];

    constructor(nid, selectedMonomers) {
        this.particles = selectedMonomers.map(mon => {return mon.id;})
        this.nid = nid; // Separate Indexing for network objects?
        this.reducedEdges = new Edges();
        this.reducedEdges.nid = this.nid;
        this.masses = [];
    }
    ;
    toJson(){
        // We'll write this in a little bit
    }
    ;
    selectNetwork(){
        api.selectElementIDs(this.particles, false);
    }
    ;

    // Functions above are meant to be more universal

    // Functions below are specific to generating each network
    edgesByCutoff(cutoffValueAngstroms: number){
        this.reducedEdges.clearAll();
        this.selectNetwork();
        let elems: BasicElement[] = Array.from(selectedBases);
        let elemcoords = {
            xI: elems.map(e => e.getPos().x),
            yI: elems.map(e => e.getPos().y),
            zI: elems.map(e => e.getPos().z),
            distance: function(i: number, j: number){
                return Math.sqrt((this.xI[i] - this.xI[j])**2 + (this.yI[i] - this.yI[j])**2 + (this.zI[i] - this.zI[j])**2)
            }
        };

        let simCutoffValue = cutoffValueAngstroms/8.518;
        for(let i = 0; i < elemcoords.xI.length; i++){
            for(let j = 1; j < elemcoords.xI.length; j++){
                if(i >= j) continue;
                let dij = elemcoords.distance(i, j);
                if(dij <= simCutoffValue){
                    this.reducedEdges.addEdge(i, j, 1);
                }
            }
        }
    }
}