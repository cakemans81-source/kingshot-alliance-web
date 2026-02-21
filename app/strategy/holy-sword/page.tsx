import type { Metadata } from "next";
import StrategyMap from "@/components/strategy-map/StrategyMap";

export const metadata: Metadata = {
    title: "성검 전투 공략 | Kingshot Alliance",
    description: "킹샷 성검 전투 전략 시뮬레이션 맵",
};

export default function HolySwordPage() {
    return <StrategyMap />;
}
