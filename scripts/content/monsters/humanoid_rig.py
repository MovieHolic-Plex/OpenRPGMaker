"""두 발로 서는 몬스터(좀비·미라·해골·리치·고블린)용 관절 뼈대.

엉덩이 hip → 몸통 기울기 lean(도, +는 앞=오른쪽으로 숙임) → 목 → 머리. 팔은 어깨에서 위팔 각·아래팔 각,
다리는 발 좌표를 받아 무릎을 앞으로 꺾는다(ik_side). 그리는 순서는 먼 팔 → 먼 다리 → 몸통 → 가까운 다리 →
머리 → 가까운 팔. 종마다 Look 의 함수(leg·torso·arm·head)로 옷·뼈·붕대를 입힌다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from pixel_lib import add, ik_side, polar

GROUND = 60


@dataclass
class Pose:
    hip: tuple = (30.0, 42.0)
    lean: float = 0.0
    torso: float = 12.0
    neck: float = 3.0
    head_tilt: float = 0.0
    # (위팔 각, 아래팔 각) - 0 = 오른쪽, 90 = 아래
    arm_near: tuple = (80.0, 60.0)
    arm_far: tuple = (100.0, 80.0)
    # 발 좌표(가까운, 먼). y 는 바닥에서 위로 뺀 값
    foot_near: tuple = (36.0, 0.0)
    foot_far: tuple = (25.0, 0.0)
    extra: dict = field(default_factory=dict)


@dataclass
class Look:
    leg: Callable          # (cv, hip, knee, foot, far)
    torso: Callable        # (cv, hip, chest, lean, pose)
    arm: Callable          # (cv, shoulder, elbow, hand, far, pose)
    head: Callable         # (cv, center, tilt, pose) -> dict
    upper: float = 7.0     # 위팔 길이
    lower: float = 7.0     # 아래팔 길이
    thigh: float = 8.0
    shin: float = 8.0
    hip_w: float = 3.0     # 앞뒤 엉덩이 간격
    shoulder_w: float = 3.0
    ground: float = GROUND  # 바닥 기준선(칸 - 4). 96 칸 거구는 92


def joints(look: Look, P: Pose):
    hip = P.hip
    chest = polar(hip, -90 + P.lean, P.torso)
    head_c = polar(chest, -90 + P.lean * 1.2, P.neck + 4)
    hn, hf = add(hip, (look.hip_w / 2, 0)), add(hip, (-look.hip_w / 2, -1))
    sn = add(polar(hip, -90 + P.lean, P.torso - 1.5), (look.shoulder_w / 2, 0))
    sf = add(sn, (-look.shoulder_w, -1))
    fn = (P.foot_near[0], look.ground - P.foot_near[1])
    ff = (P.foot_far[0], look.ground - P.foot_far[1])
    kn = ik_side(hn, fn, look.thigh, look.shin, forward=True)
    kf = ik_side(hf, ff, look.thigh, look.shin, forward=True)

    def arm(s, ang):
        e = polar(s, ang[0], look.upper)
        return e, polar(e, ang[1], look.lower)
    en, hn_ = arm(sn, P.arm_near)
    ef, hf_ = arm(sf, P.arm_far)
    return dict(hip=hip, chest=chest, head=head_c, hip_n=hn, hip_f=hf, knee_n=kn, knee_f=kf, foot_n=fn, foot_f=ff,
                sh_n=sn, sh_f=sf, el_n=en, el_f=ef, hand_n=hn_, hand_f=hf_)


def draw_body(cv, look: Look, P: Pose):
    J = joints(look, P)
    look.arm(cv, J["sh_f"], J["el_f"], J["hand_f"], True, P)
    look.leg(cv, J["hip_f"], J["knee_f"], J["foot_f"], True)
    look.torso(cv, J["hip"], J["chest"], P.lean, P)
    look.leg(cv, J["hip_n"], J["knee_n"], J["foot_n"], False)
    J.update(look.head(cv, J["head"], P.head_tilt, P) or {})
    look.arm(cv, J["sh_n"], J["el_n"], J["hand_n"], False, P)
    return J
