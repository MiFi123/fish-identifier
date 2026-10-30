"""Functional deployment check, not an independent accuracy benchmark."""
import base64
import io
import json
import os
from pathlib import Path
from PIL import Image
import hosted_worker

def memory_mb():
    if os.name != 'nt':
        import resource
        return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)
    import ctypes
    from ctypes import wintypes
    class Counters(ctypes.Structure):
        _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD)] + [(name, ctypes.c_size_t) for name in ['peak', 'working', 'peakPaged', 'paged', 'peakNonPaged', 'nonPaged', 'pagefile', 'peakPagefile']]
    value = Counters()
    value.cb = ctypes.sizeof(value)
    function = ctypes.windll.psapi.GetProcessMemoryInfo
    function.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    function(wintypes.HANDLE(-1), ctypes.byref(value), value.cb)
    return round(value.peak / 1024 / 1024, 1)

models = hosted_worker.load_models()
example = (hosted_worker.DIRECTORY / 'example.png').read_bytes()
result = hosted_worker.analyze(base64.b64encode(example).decode(), models)
assert result['status'] == 'candidates' and result['candidates'][0]['scientificName'] == 'Tinca tinca'
blank = io.BytesIO()
Image.new('RGB', (640, 400), (230, 230, 230)).save(blank, format='PNG')
negative = hosted_worker.analyze(base64.b64encode(blank.getvalue()).decode(), models)
assert negative['status'] == 'no_fish' and not negative['candidates']
print(json.dumps({'example': {'top1': result['candidates'][0]['scientificName'], 'elapsedMs': result['elapsedMs']}, 'emptyImage': negative['status'], 'workerPeakMemoryMB': memory_mb(), 'scope': 'functional check only'}), flush=True)
