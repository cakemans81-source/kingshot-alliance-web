import { redirect } from "next/navigation";

/**
 * /strategy 에 직접 접근하면 기본 공략 페이지인 성검 전투로 리다이렉트
 */
export default function StrategyIndexPage() {
    redirect("/strategy/holy-sword");
}
