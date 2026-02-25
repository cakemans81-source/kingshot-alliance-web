import { redirect } from "next/navigation";

/**
 * /strategy 에 직접 접근하면 삼대 연맹 전투 페이지로 리다이렉트
 */
export default function StrategyIndexPage() {
    redirect("/strategy/three-alliances");
}
