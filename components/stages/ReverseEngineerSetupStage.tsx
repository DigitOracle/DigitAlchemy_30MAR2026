"use client"
import { useState, useEffect, useRef } from "react"
import { PLATFORMS } from "@/config/platforms"

type ProductionLag = "same_day" | "24h" | "48h" | "72h" | "1w" | "2w" | "4w" | "6m" | "12m"

const REGIONS = [
  { code: "AE", label: "United Arab Emirates", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/AE.svg" },
  { code: "SA", label: "Saudi Arabia", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/SA.svg" },
  { code: "KW", label: "Kuwait", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/KW.svg" },
  { code: "QA", label: "Qatar", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/QA.svg" },
  { code: "US", label: "United States", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/US.svg" },
  { code: "SG", label: "Singapore", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/SG.svg" },
]

const INDUSTRIES = [
  { id: "real_estate", label: "Real Estate", icon: "🏢" },
  { id: "automotive", label: "Automotive", icon: "🚗" },
  { id: "hospitality", label: "Hospitality", icon: "🏨" },
  { id: "food_beverage", label: "Food & Beverage", icon: "🍽️" },
  { id: "fashion_beauty", label: "Fashion & Beauty", icon: "👗" },
  { id: "fitness_wellness", label: "Fitness & Wellness", icon: "💪" },
  { id: "ecommerce", label: "E-commerce", icon: "🛒" },
  { id: "education", label: "Education", icon: "🎓" },
  { id: "healthcare", label: "Healthcare", icon: "🏥" },
  { id: "financial_services", label: "Finance", icon: "💰" },
]

const AUDIENCES = [
  { id: "gen_z", label: "Gen Z", subtitle: "18-24" },
  { id: "millennials", label: "Millennials", subtitle: "25-40" },
  { id: "gen_x", label: "Gen X", subtitle: "41-56" },
  { id: "boomers", label: "Boomers", subtitle: "57+" },
  { id: "all_ages", label: "All Ages", subtitle: "Broad" },
]

const QUICK_PULSE_OPTIONS = [
  { id: "tiktok", label: "TikTok Trending", icon: "\ud83d\udcf1", platform: "tiktok" },
  { id: "instagram", label: "Instagram Trending", icon: "\ud83d\udcf8", platform: "instagram" },
  { id: "youtube", label: "YouTube Trending", icon: "\u25b6\ufe0f", platform: "youtube" },
  { id: "news", label: "News Headlines", icon: "\ud83d\udcf0", platform: "tiktok" },
  { id: "wikipedia", label: "Cultural Pulse", icon: "\ud83c\udf10", platform: "tiktok" },
]

type Props = {
  onConfirm: (platform: string, niche: string, lag: ProductionLag, region: string, industry: string | null, audience: string | null, quickPulse?: string) => void
}

const scanPlatforms = Object.values(PLATFORMS).filter((p) => p.id !== "heygen")

const TIME_GROUPS = [
  {
    id: "react_now",
    title: "React now",
    subtitle: "What should I post today?",
    color: "border-red-300 bg-red-50",
    selectedColor: "border-red-500 bg-red-100",
    options: [
      { value: "same_day" as ProductionLag, label: "Same Day" },
      { value: "24h" as ProductionLag, label: "24 Hours" },
      { value: "48h" as ProductionLag, label: "48 Hours" },
      { value: "72h" as ProductionLag, label: "72 Hours" },
    ],
  },
  {
    id: "plan_ahead",
    title: "Plan ahead",
    subtitle: "What should I build toward?",
    color: "border-amber-300 bg-amber-50",
    selectedColor: "border-amber-500 bg-amber-100",
    options: [
      { value: "1w" as ProductionLag, label: "1 Week" },
      { value: "2w" as ProductionLag, label: "2 Weeks" },
      { value: "4w" as ProductionLag, label: "4 Weeks" },
    ],
  },
  {
    id: "analyse_history",
    title: "Analyse history",
    subtitle: "What has worked in my industry?",
    color: "border-blue-300 bg-blue-50",
    selectedColor: "border-blue-500 bg-blue-100",
    options: [
      { value: "6m" as ProductionLag, label: "6 Months" },
      { value: "12m" as ProductionLag, label: "12 Months" },
    ],
  },
]

const PLATFORM_LOGOS: Record<string, string> = {
  "instagram": "data:image/png;base64,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",
  "tiktok": "data:image/png;base64,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",
  "linkedin": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAWwUlEQVR42t2b249tWXXef2PMtdauXefUuQNu7AYbjJvGhBilaSwrhIg8RCIKyLIsR0o6wvGDZeGbHDuXpxApL5aIolyk3BSUkCcUIApIiUAWJkoC2KIdAg2026Hb3S1ON6f73Oq6L2uOkYd5WXPtOv0PpKRSVe1ae+05xxyXb3zjW2IWHVMikS440HF/teWVoxXb0VAXogAOiIODCwjptfIvxxEXAATHcR74lW5RfkWY7lXeI/n/Nn8b4uXe0+fufolb+q/DMARuXL/A1cUAREYTOnEQBQQRkc5EMDF6WfEnrzifefIe333+iPunPXFcgIPZttmmEc0RBMwQwBDcvO5O0lW4O25pG5p34+51Q+6ebGoG3pjMwd3S3wJmjrujDmpeLeTm4BHKPT2tQTyAQ9/BwTV4/Cev8Dff91Z++KGBbQz0QSaDxXHjKsoXvnPEv/niq9w5OaDrFxBA1BAf0bEYNS3U3BHPm3XHSIuU5ng9G8AsvRDMwZqFSlp3NQBejUO5nyRPcvdqIM8GEBHMDM3vLQaJgIugDvjIalyzOXXedDnyW7/8dv7SO2+AB0Q7RETEPfpXnr3DP/rUKZtwlf3hCBuzO5sSRbDscGYjdY35FzHPfkE1StqMJWfN/ipmeIwpQDy5g7mnw7T002YGsOzulmKh+LxZ4ynpMMrbqpfk+7pF3HpENxyNp1yWjn/62+/g3W+7jtOhKiKvrrf+9z55kxduC323x5aIoEjv+HZE1iOSdof5WCKh+PDk0s1PyT+tiUepb0qba2yYfnHHSKGVXB7U4yxpSDU42TNyeFS3c7IfIuVeGNFW9Lrg7PCMn3rHgn/xd/8CSzE0BOmefOY+L7xs9Bf2iDEQw5b9CIfPvsArz79IWI1EEZDkkgCumj9EQNK3i6OqU2whqCigdY8igkiKPw2KCzOjhaAIJUEpUQzDCRrmyVDTZ4oKTTSn++Y1pOsUx1DrsQjLiwuefPou33rmFu999PUAdLfujWxkQL1H3Flq4AdPPc29P36arlNMBFwQ0gfiIEGnjahi6ZL04VKCW7KBQlkNqqEuWIKQXCsvXYQUGekemmIUlRxatWoo4poOxNM63B0RUNmpP27ghrrng+hZbxc89cztyQCq+7gcJksFYXXrVe489yx7i4FNSAmlE8cJadOeTkBEU4RmQ6DZ9URwFBdpTkaQbCjRYjzHsneoFi8Czx6ApE1qsk36XBFEQ7q3lM9KF0j2xLY4ppcUN8Pd0BgR67h5d1Ov6RQj4IiPiPQcv/oqYiMxdGgUOgISbLaZKI7JdCqKIF7cUVARzMtGUigYVsteMoCgpmmRloGFKqJKrX/teWpGGGWfOiVNDaGupWzcSziIEh3wmDCCR0abru5gxGOX41DwmN1XFcGIMhII+cbF1ZhFnovneJbqili+HlBxUJ3qdzGlTjkBSWmr3DTlmxxGNCec1+C5ckjomjyQQjEtUHAJORcZREEk4DLSmdec0blbLm8pY6ZanpciSiqo0vhU43LZ5ctrKe4V83JKQqmM9boZbJvCpuSS2X3LVzFUSXDu9T2+c305ecmHVkIlmhE6PYccu3xwqW5LctNS0qSpeCXeSpmZo9sUs4qSMc4sUTYmbBYr1dNrLLf3zDeSnFhdpJbXcg8RwZpUIznxps1XkI2b1fTgOx/UIRPELQBFRPMHUF2vLGD3hKprejrt5B1aY6yWJWG28Go0zVlc5/evJ68lIc5Lac3+TemdPEJqKS2mdQdzw8wqPAfoDM3Z2CbUVqy3E+ttnHm5TjXljtwhSUiG2/X3VLImS6T3Nh5RIfR08j5dmSGwgAYkhxY5/5RDoxqvQWs1zJLvVnBVDODuWLRcki1ZN2g+Oa+x2564NDGfkB2TtzSnMTOASgY5+dQErM0l1FqXT34KoVoC8ybdm5gXR0VzWRZkdmhSr3ezlBvddnKAT1EtPgVsiU/fzfjl1gXllTWr5nr+4DbV3fFcFdotT17ltYq0eSPFfCqtolPMF6cRFJHA+Qw7VZlclKamydsckDuy0qnVehwUI06nTgM+ShIzz/kivX66ipg7fR9Y7imecbpqDrNQ8kFeGDunlU/eC7DK2V52PSV7oDZrqaUSn3lB3VTpJneyYOc+maS2niUFuNbfaynTlO3FnChKCIExKnFzzHvecZXrNy7w3HOHfO/FU/RioGdIXZ0aSji3uBbN0VacfPIlFGrMa27DRTNWocZ4MoJPiThvWnKVQ867Z+fimVhI6K64uBfIJdk9i6VFwAR1R/uObRy5un/K3//Nn+EDj72eXgeOViP/7tPf4ROffZblYsnIGSLT5mXHCsVVvVaI7JUZyVUAJYUW0prc2oCRDMgkN2fkhswz8HZP+2rZKq3x6XNCQqT9lppoUhA6EgKizvZsxUc/8k4++N4fxY+N7ekZywC//sS7+MBPvYGz4xV0fS5J8zImBVZmz6on7ylsRHc7SRAJBO1yDprfS2puKnSdoBJqLvECBBov0NaIkm84dXWz5rYcQaLUNDDaljdcu8Lj734z6+19vB/wsM9mI/QOf/Hxi5ye3iJo6gGqmxf6S2VWTbzFDtX7Sl5KeGCe8HZQY1vCS3JsPKXkj/agu2Rwn9Cge8q4tfHIb7KmG2Nb+YAuOJ06yoIYIhBRHXFgLxxwdnLIeHKFxd5lRhmn3C/M4G0hQ7TtD5rNFaN43XTxAJtdX6F1a6jdHEfrAZIppkJhlQvFUyYWqSAm3dhzSwp73R4v373DN757n75fYusNvvVESck+v/+HzyLSsT48YnN0SPCygUR8WGV/c+bRAKHDVDHNPb/YDsYotdqAmPNTqiylIiipZTYBC4KrEDKx2pb9WgZTv5woZcmxLjV5zLN1bTNRLAr94oB/+R+/ykOvX/KeR64BkQ09/+Ez/4fPf+EpDg5ugG85ObrLnjp7ly+xzffQprqkb9spY5JIFAmJlJG2L5NZQzVBeM1JPCfXoJnZtoQjzGY5oJNS9bw6V04Nk/ucb2y8kppDv8eLd/b41Y99mT//6GVuXL3Ad7/3En/w5ItIuJE9ywghsD47hA4WB5dxTX4Qa2c3R5HJ0AGVUPt+3+mqEr6YpgsqyTMrTyyFJ9wFWa0H4BmwTOSkUri5PEM4B29T7yABojodwsnY8bmv3ubo9k0CGw4uXENwAltSv2Gwdc5uH+IxsHf5gLVFui6knCPKdqtstjH3A0IIkb4Xhi6gGnBiIoilwQpSmh6dCNjcj7TNU8pvpcrMkGAebXjIJ5t4QAVcc8bH5+GA5fgU3CIXh4Hl8gJcW8LDkbN7d/CzFSfrno0FEKPTnisXDGHAOaFjyeLSgk007scB7p/w0PUlb/8zBzz0+gHVwKvHZzx/M/LsiyvWGtjb2yNwisuSKE5nI3ifPSat3iQl8VRkcmhltKsuiPuuB0hCaua1s0JLfc7NkIYHcG1CUOXe0Yq/9eGf4IkP/TinJ1s6DURz4p7zdz723/ja14/p+oG3Pdzxz373wwRxkA2+Vi5dUj7+iW/zn/7ni/zKE4/ys+/7UR66MtAzAj0R53i94RvPHvJvP/s0Tz/fs7+/qFjEtEPp0gFJinndQcCFSscK0SM7fMAOPhaZtylewYLMCBCHjLKU5b5y+WLP0G8JIfUV3TCwVAUZ8XBE0Ndx43LHQk9ROmwzEPaVS/2Wj33kUf7aB9/OenNKPIlE7zAdcetYmvP+Ry7zlt/4Gf7BP/86T704sNdD78Y2LBqQM7XhM76ABntk9lhmZdCnjVIvktzdaeb2qextqccJZCQCwsaUdeNW8Y3iG4jjNhNsAxovYh5YxzXjdmC12WPrcLo65cN/5RE+9JffzPHJhs16YJSABYEQicsjxkE4OzV+eF/5tZ9/hEW8zdgFRPu0eMlJWmVWsXgADSecA4JoO1WpLiINxdTS217QoSZiQjTx/lpAjeEacVVgIIohGhOCQ+hKag0bJGwR7/mxH7pMOOsZ9iIHBwsu7ncMwxkSA8vNRTofkE5Zr1f82bdc550PDxweHqJ9JrMS+1o3e46HEMXcExPkco4TS8XHG4xcSk7TmCuBIKH23m0NVhF0p8NP8NVAAprjEwWhwzTi3uVE2rHeQLcUXrnj/N5XnuH3vvwcL7y6phsC0TaZflfMOlSdxx99I2cv32I9HqGhy+swEAiiE0iWgio1AzrDXXMVsB0o3IZAA0yqtXbZW3Y85HwDXru8gl5KTHrVFATUIsvlgi/97z/lH/6T/8HLtyPuF7h2seN3f+cx3vfYdTZba9oF40feeIFFMM7u3efg0oAOXUarglquVyqzMC4GKWP2NufVbhD3qnioICJXA294QJ81HZkEPb/1eq3Ue3gTTobZHiGccrw65h//62/w/VcGrl14HRevOLfOVvyrTz3JyoYpSaVqzbVrAxf3e2TrnN67i20jXSZxC5lTDqw0XYLMNASzHFBo41jgMDnRIc1NJU1fVCeOvjYd8iARyIz7rx1mayDWhK7nO//3Ps/dPOPqwYJVXMM2cLA/8MIPIj+4fUbXh+o1ZjDsd4QuJAhjzur+EbYZERFGcSQIIYQmWWfO2ybK383nVUAkYTVp66QDXgaRMi+EjZTDd3jDIppo3+AqGEnd4SRAAls0LLh1d8NohjlEVYIOCIHRRlZnVvuFMuzu6RA1vPACjJwc3sfGDaETIoLXqbTW3CSuKGOZYsyrQE0MWacjkk5cVRPxsUtk6BT70nYoOz8LG3Nex0PtN2J0zBK/0AfN3WaH053D/qmX1OSIqmjIZKk7Z0fHMEZ61Tp/bPFA4kJiHanNQ6A5VCMBLcMT4Nqhu2sSyf+z1xArUQjNhtZumJeJosgzgKCKixMz5eWuD2B6J66wJFRFCKKoO2f3j7DtNlMMedIlzi4V/IAckDYVY2KBtdMpg8t5gkJCYo0RRZtO8cGlQBo6Uc4NWkQkCSNKW5uzrIb+/ECGqXPUnH9MmxwlwsnxCRYjoQtpjXkG8VqqNW0VGpOVJkJ0xsw0rzmT+/tr7N9rydAZdmh3Ngnrcnkss4WsDtn1L8ER6ZEAhBQ6rTZBxTk9PWaMY3pdaUqw4TuTIZWdzadZf+6edloHybw9zdRmJkko1JrQcICak9I8kc54OhqFSZcHLKEk13ZwkwlZ+pS9lKz2St4omvOWOWfHJ9jWkMoC56GM+JSkW1J0NhU+N/5uwE6bWCrIeUAhlJQEy4jtvHvsJs+EMgv7nFDng1xLGtaqeKBkFlkq5BZzNienaJwjXDk3FyikaNNIniMZVc4NMNru8UGLrAqPnVTuu2pRnxDmrDr75FuTMjRJ9rxIRMpAVCeQVniMkHuAzWqVhZipS3XzndFYmbxOo+F5EyQNb79DXRcG1zzBzOgOlsbQnTVIOhMWVfzoMQkyDNwF0S41V9bKWFMLb1kLmCg4y9WlSw6teTSnTU7Ka/XsIS6Oxdj0OzujMXxMFdkjWMjlY5616xn6xN6WKmCiLIaAqnCw7LPGJ4Iu6HWb3DMqBFjuO4EB0y2LcUBUWeyB6RZCnBRHWVKzPwxoGNgfytR6ZFh0iBgeekLLTZC4CWkaoOJZVdpRzvTcXKC4RRkgNk3O3DVzolKtzePQBf70pRO+9u2X2a5Ggkgaqu513FuBdoGgynpjfPWbd/E4MPZrGJ2Ly8B3nz+m1z3UQsIAecSloeOPnrnP/aMFqzHrCAfn+dsbYj+i3iG+xCXmeaA2A5WUrLWF4P7gMtgJkw6tPfFW0V2SYxlXlXiL7iz3e/7r//oBn/ovTzGuThi0ByJCRIerLBYLgm65ebvjox/77+D7eLeqJYuwR79/ia2uqxocTZrBj//7b2aAVNRmINJhiyUhCC4xzwqlNl0lfLUMXdpw9vPDkW5WAbJUJcHMMAMrsxZZpzkfAv1inxs/9DBn9+6wPl0RQp/UpR4JGpOSyx3bu4BKIHAZgmAhKbuDnaaF6dBUn45+0c0EGqY9FpTgI0IgiqWqkYeodfMhVP1QmS7XZshsVyOUZwLeiBEKAijtZDn5mpWtKYGJm/de6G5cYn03sj45Y9BAlydLnhkR9SSZK1hDY1F+DrgpnlWRJcyi2kwohYyoGCJdGpRoN/UlKrMeBplY4Vn52ZmQd1XRbZ5FzFKnK2kyk3psr/O4NC6fJC+grpC1BJcu3+DM7rFZrehCl4woMYOnBFdNfRpi6oirZg1PqJudCyOaE/au8hRaAFkGaOVvb05egk7F1M4jEvWGJ68MayEYNQ1DdxuIMnwsvEElPwhI6Di4foP+4gU2WIK2GdQkDJ8y9kRY6qTtrqPy6Xef/T0NraqGSCYcITr1MLVrVW0kcv4AmVyVtpNIkVzrJ2s25tGWAtN8s6z6llhFDluc/atXOAXi2Zqh7zDRBjk1Ko4mayc4O2kGpNn8TBNcQkLn43yvctsdQ5ZnFIRzD2YoPj1qMhcWSTOPkybbznm2tH7LMlqvBnMNHFy7znBhn+jQNf3DJKvVyXUz28Ts5ItIQqYRWKHqy8mHkJJeNcbEBYp0qHRV8bLLB+YymJ6ykIbJmeKmMDo2Sc52amqR/lVsXkZQ0hM7Y3njKqs797D1hi50RBzKcwGVy5snMq8bbfuEBv8Xxjdn+8IFaiIXcFFUusxgJ9RYRuPEOHsaS1+7jW+4dtHXlKWU/09tdc4bNdsqB1evEpZL1m54yAMVbTTGOyev1Y11rhvM7xFtsr2W90jt/7W0yNkrEyGXFKISdzjBaVIiD25ppAiP9QGa0V3Bk9S5QSoK6TRHDexfvUK/v2xEDFOMthRbWjiViWamI5JakkUnBUuC5UWpGvIBpAcyFGd7dDhJ6EUQGScDJBbIG51wM1rKVNUETrTREe/kCYrb5Y4Nr0KKKAELgYtXrxCGIYsXQtb2FqnxPMn6OaUWk4w/zyZEBA+TmNo1lWPPn7/cX3Lv9i3Obt9h0EDEiQL7FxdTDhi6LcYWYw/xLZEtSsjQM1T5yaTmzFxfRoNUgXSXM24JyakUJSl88rNL165yeniExVg5Q8miaQkZYdYSF1K+0KIi0+a+6XcLhQhJYgrP3GKPcPrSS3z/W9+k8y0e99JzA77hJ996bTLA4+96A1c+f5fjUehZo7ZE2IAHom0bwkPqY3Cx0YlUuX1DrEhGl1XAwMTuqIPFyLjZ7vKjkxaxjjM8q8qbZxV8R63usarbKjEgcHZ6zOrObfbGjigdm+4U2yx40/V9fvrPva1in+6RN17jr77/Ep/49E32X7dMXFp+cMks9dHq5blB45yu0NNDkmCTiNmBOO4wyTZ7pE7MZ/OF8rDkrE4Xqj5ncM811POwM31gzGvLKddypypOFwLIhoBBWHJ875C//YuP8dDr9og2ZigcnV/68Nt46eYRX/zKfS5cukDfdZjFJFqSietTKQ8n7tRTbxmcMobS+UOQrvk8M4MTvZajKo7MD2xMbpHV5YXL98QLJmOGLMDu06jNPStdEtFiWfBlIsT1lqOXDvkbP/d2PvLX302MG0JhnaO5KyN3tsIn//PTfO5Lz3PrvhAzKyluNX5xiBbzY6k+19s0QiZ3m5Uaz88Ys6PZ9WgVpaUTtblUnDmTI43wuXjL9ExyfhqVmIwbBVEDX/MjN/Z54hfexS898Rg9iWuQRJ6IRHfX4p4aePbVE/7o27d4/uYx69P02NpWbUduOikNdlm76rLmzUt+bnAoXh40oJIxuDUZACZgPmPs6sPVsyalDj0t5YEIF/cH3vLj1/np97yJh29cwG2NyKKV2mUDYLhFzAMhKP//fY1YNFT7KWtnA/w/HQkc4Spxe4IAAAAASUVORK5CYII=",
  "youtube": "data:image/png;base64,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",
  "x": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0iIzAwMCIvPgo8cGF0aCBkPSJNMTYgMTZsMTIuNSAxNkwxNiA0OGgzLjVsMTAtMTIuNUwzOSA0OGg5LjVMMzUgMzFsMTItMTVoLTMuNUwzNCAyNy41IDI1LjUgMTZIMTZ6bTUgM2g0bDE4IDI2aC00TDIxIDE5eiIgZmlsbD0iI2ZmZiIvPgo8L3N2Zz4=",
  "facebook": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0iIzE4NzdGMiIvPgo8cGF0aCBkPSJNNDIgMzIuNWgtNlY1NGgtOFYzMi41aC00di03aDR2LTQuNWMwLTQgMi41LTggOC41LThsNSAuMDV2Ni45NWgtMy41Yy0xLjUgMC0yIC43NS0yIDJ2My41aDUuNWwtMSA3SDM2eiIgZmlsbD0iI2ZmZiIvPgo8L3N2Zz4=",
}

export function ReverseEngineerSetupStage({ onConfirm }: Props) {
  const [platform, setPlatform] = useState<string | null>(null)
  const [niche, setNiche] = useState("")
  const [lag, setLag] = useState<ProductionLag>("same_day")
  const [lagChosen, setLagChosen] = useState(false)
  const [region, setRegion] = useState("AE")
  const [industry, setIndustry] = useState<string | null>(null)
  const [audience, setAudience] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    if (!openDropdown) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenDropdown(null)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [openDropdown])

  function handleQuickPulse(regionCode: string, quickType: string) {
    setOpenDropdown(null)
    const opt = QUICK_PULSE_OPTIONS.find((o) => o.id === quickType)
    onConfirm(opt?.platform || "tiktok", "", "same_day", regionCode, null, null, quickType)
  }

  const activeBranch = ["same_day", "24h", "48h", "72h"].includes(lag) ? "react_now"
    : ["1w", "2w", "4w"].includes(lag) ? "plan_ahead"
    : "analyse_history"

  const showIndustry = activeBranch === "plan_ahead" || activeBranch === "analyse_history"
  const showNiche = activeBranch !== "analyse_history"
  const industryRequired = activeBranch === "analyse_history"

  const canSubmit = !!platform && (!industryRequired || !!industry)

  const buttonLabel = activeBranch === "analyse_history" ? "Analyse History"
    : activeBranch === "plan_ahead" ? "Plan Content"
    : "Scan Trends"

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm animate-fade-in max-w-lg mx-auto">

      {/* ── STEP 1: Region (always visible) ── */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Target region
        </label>
        <div className="flex flex-row gap-3" ref={dropdownRef}>
          {REGIONS.map((r) => (
            <div key={r.code} className="relative flex-1">
              <button
                onClick={() => setOpenDropdown(openDropdown === r.code ? null : r.code)}
                className={`w-full flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors ${
                  region === r.code && !openDropdown
                    ? "border-[#b87333] bg-[#b87333]/5 text-[#b87333]"
                    : openDropdown === r.code
                    ? "border-[#b87333] bg-[#b87333]/5 text-[#b87333]"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <img src={r.flag} alt={r.label} width={36} height={24} className="object-contain rounded-sm" style={{ width: 36, height: 24 }} />
                <span className="text-[10px]">{r.label}</span>
              </button>

              {openDropdown === r.code && (
                <div className="absolute z-10 mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-56 animate-fade-in">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Pulse</p>
                  {QUICK_PULSE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleQuickPulse(r.code, item.id)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-xs flex items-center gap-2 transition-colors"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <button
                      onClick={() => { setRegion(r.code); setOpenDropdown(null) }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-50 text-xs font-medium flex items-center gap-2 text-amber-700"
                    >
                      <span>&#x1f50d;</span>
                      <span>Deep Dive &rarr;</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEP 2: Platform (appears after region) ── */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${region ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Choose a platform to scan</h3>
      <p className="text-xs text-gray-500 mb-4">Select one platform to find what&apos;s trending now.</p>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {scanPlatforms.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border-2 text-xs font-medium transition-colors ${
              platform === p.id
                ? "border-[#b87333] bg-[#b87333]/5 text-[#b87333]"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {PLATFORM_LOGOS[p.id] ? (
              <img src={PLATFORM_LOGOS[p.id]} alt={p.label} width={32} height={32} style={{ width: 32, height: 32 }} className="object-contain" />
            ) : (
              <span className="text-sm font-bold">{p.icon}</span>
            )}
            <span className="text-[10px]">{p.label}</span>
          </button>
        ))}
      </div>

      </div>

      {/* ── STEP 3: Time horizon (appears after platform) ── */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${platform ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          What are you looking for?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TIME_GROUPS.map((group) => {
            const groupSelected = group.options.some((o) => o.value === lag)
            return (
              <div
                key={group.id}
                className={`rounded-lg border-2 p-2.5 transition-colors cursor-pointer ${groupSelected ? group.selectedColor : group.color}`}
                onClick={() => { if (!groupSelected) { setLag(group.options[0].value); setLagChosen(true) } }}
              >
                <p className="text-sm font-semibold text-gray-900 leading-tight">{group.title}</p>
                <p className="text-[10px] text-gray-500 mb-2 leading-tight">{group.subtitle}</p>
                <div className="flex flex-wrap gap-1">
                  {group.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={(e) => { e.stopPropagation(); setLag(opt.value); setLagChosen(true) }}
                      className={`px-2 py-1 rounded border text-[10px] font-medium transition-colors ${
                        lag === opt.value
                          ? "border-[#b87333] bg-[#b87333]/10 text-[#b87333]"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Trend Radar scores trends based on whether they will still matter by publish time.</p>
      </div>

      </div>

      {/* ── STEP 4: Conditional fields based on branch (appears after time selection) ── */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${lagChosen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>

      {/* Industry selector — Plan Ahead (optional) or Analyse History (required) */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showIndustry ? "max-h-[300px] opacity-100 mb-4" : "max-h-0 opacity-0"}`}>
        <label className="block text-xs font-medium text-gray-500 mb-0.5">
          {industryRequired ? "Select your industry" : <>Industry <span className="text-gray-400">(optional)</span></>}
        </label>
        <p className="text-[10px] text-gray-400 mb-1.5">
          {industryRequired
            ? "Historical analysis requires an industry selection."
            : "Select your industry for tailored recommendations. Skip for general scanning."}
        </p>
        <div className="grid grid-cols-5 gap-2">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind.id}
              onClick={() => setIndustry(industry === ind.id ? null : ind.id)}
              className={`flex flex-col items-center gap-1 px-1 py-2.5 rounded-lg border-2 text-xs font-medium transition-colors ${
                industry === ind.id
                  ? "border-[#b87333] bg-[#b87333]/5 text-[#b87333]"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <span className="text-base">{ind.icon}</span>
              <span className="text-[10px] leading-tight text-center">{ind.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Audience selector — all branches, optional */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${lagChosen ? "max-h-[120px] opacity-100 mb-4" : "max-h-0 opacity-0"}`}>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Target audience <span className="text-gray-400">(optional)</span>
        </label>
        <div className="flex gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.id}
              onClick={() => setAudience(audience === a.id ? null : a.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg border-2 text-xs font-medium transition-colors ${
                audience === a.id
                  ? "border-[#b87333] bg-[#b87333]/5 text-[#b87333]"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <span className="text-[11px] font-semibold">{a.label}</span>
              <span className="text-[9px] text-gray-400">{a.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Niche input — React Now + Plan Ahead only */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showNiche ? "max-h-[120px] opacity-100 mb-4" : "max-h-0 opacity-0"}`}>
        <label htmlFor="re-niche" className="block text-xs font-medium text-gray-500 mb-1.5">
          Niche / topic <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="re-niche"
          name="niche"
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. fitness, cooking, AI tools — leave blank for broad trends"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#b87333]/20 focus:border-[#b87333] transition-colors"
        />
        <p className="text-[10px] text-gray-400 mt-1">Blank = broad platform-wide scan. Filled = niche-specific trend scan.</p>
      </div>

      {/* Submit button */}
      </div>
      <button
        onClick={() => platform && canSubmit && lagChosen && onConfirm(platform, activeBranch === "analyse_history" ? "" : niche.trim(), lag, region, industry, audience)}
        disabled={!canSubmit || !lagChosen}
        className="w-full bg-[#b87333] text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#b87333]/90 transition-colors"
      >
        {buttonLabel} &rarr;
      </button>
    </div>
  )
}
