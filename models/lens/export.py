"""
Re-creates the two Compass Lens models. Only needed when the vocabulary or the models change.

    pip install ultralytics onnx onnxslim git+https://github.com/ultralytics/CLIP.git
    python models/lens/export.py

detector.onnx  YOLOE-11s (open vocabulary) with the LensLabel vocabulary baked in, NMS included.
               output0: [1, 300, 38] = x1, y1, x2, y2, score, class, 32 mask coefficients (unused)
embedder.onnx  YOLO11s-cls backbone + head conv + pooling, L2-normalised.
               images: [n, 3, 224, 224] RGB 0..1  ->  embedding: [n, 1280]
"""
import shutil
from pathlib import Path

import torch
from ultralytics import YOLO, YOLOE

OUT = Path(__file__).resolve().parent

# Same order as LensLabel in apps/compass-api/src/libs/enums/lens.enum.ts
VOCABULARY = [
    "sofa", "armchair", "chair", "dining table", "coffee table", "side table", "desk", "bed",
    "floor lamp", "table lamp", "pendant lamp", "rug", "shelf", "cabinet", "dresser", "mirror",
    "potted plant", "vase", "cushion", "curtain", "stool", "bench", "tv stand", "wall art",
]


def export_detector() -> None:
    model = YOLOE("yoloe-11s-seg.pt")
    model.set_classes(VOCABULARY, model.get_text_pe(VOCABULARY))
    exported = model.export(format="onnx", imgsz=640, nms=True, simplify=True, opset=17)
    shutil.move(exported, OUT / "detector.onnx")


class Embedder(torch.nn.Module):
    def __init__(self, classifier: torch.nn.Module):
        super().__init__()
        self.layers = classifier.model

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers[:-1]:
            x = layer(x)
        head = self.layers[-1]
        x = head.pool(head.conv(x)).flatten(1)
        return torch.nn.functional.normalize(x, dim=1)


def export_embedder() -> None:
    embedder = Embedder(YOLO("yolo11s-cls.pt").model.eval())
    torch.onnx.export(
        embedder,
        torch.rand(1, 3, 224, 224),
        OUT / "embedder.onnx",
        input_names=["images"],
        output_names=["embedding"],
        dynamic_axes={"images": {0: "n"}, "embedding": {0: "n"}},
        opset_version=17,
        dynamo=False,
    )


if __name__ == "__main__":
    export_detector()
    export_embedder()
