"""Curved native roof correction: original micrograin, explicit face coordinates.
The rejected cel overlay joined highlights into diagonal weave. Read original
four-pixel relief and its fine color variation without that overlay.
"""
import author_round6 as original_author

COLUMNS={
 'dome':[(0,12,0),(12,24,1),(24,40,2),(40,52,1),(52,64,0)],
 'onion':[(0,12,0),(12,24,1),(24,32,2),(32,48,3),(48,56,2),(56,68,1),(68,80,0)],
}
def repair(im,record,at,spans,style,material):
 original_author.current=record
 original_author.chosen_roof(im,at,spans,material,columns=COLUMNS[style])
 record.setdefault('round7CurvedRepairs',[]).append({
  'at':at,'style':style,'material':material,'spans':spans,
  'nativeSource':'arch:brick','nativeRect':[32,24,80,64],
  'courseDepthOffsets':COLUMNS[style],
  'textureTransferRecord':len(record['roofs'])-1,
 })
