import Link from "next/link";

function getMaturityInfo(unixTs: number) {
  const maturityDate = new Date(unixTs * 1000);
  const now = new Date();
  const diffTime = maturityDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const formattedDate = maturityDate.toLocaleDateString("en-US", options);

  return {
    date: formattedDate,
    daysLeft: daysLeft > 0 ? daysLeft : 0,
  };
}

export default function MarketsTable() {
  const markets = [
    {
      marketId: "A4foZXPmLcocrBftcLVZFcTbsderoQrSv9a6g3MwQSev",
      asset: {
        name: "JitoSOL",
        fullName: "Jito Staked SOL",
        icon: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png",
      },
      maturity: {
        unixTs: 1759814630,
      },
      ammTvl: "$1,341.21",
      pt: {
        apy: "15.54%",
        price: "$128.21",
      },
      yt: {
        apy: "31.01%",
        price: "$11.71",
      },
      lp: {
        apy: "31.63%",
      },
    },
    {
      marketId: "8E8g93aDN1qD1XB4HoLQnJQAGmr45pnHrTUVkDG2aiRM",
      asset: {
        name: "CRT",
        fullName: "Carrot",
        icon: "https://shdw-drive.genesysgo.net/7G7ayDnjFoLcEUVkxQ2Jd4qquAHp5LiSBii7t81Y2E23/carrot.png",
      },
      maturity: {
        unixTs: 1759813850,
      },
      ammTvl: "$2,567.11",
      pt: {
        apy: "21.75%",
        price: "$0.8264",
      },
      yt: {
        apy: "24.50%",
        price: "$0.00747",
      },
      lp: {
        apy: "25.10%",
      },
    },
  ];

  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="bg-gray-900 relative shadow-md sm:rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-800 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Asset
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Maturity
                  </th>
                  <th scope="col" className="px-4 py-3">
                    AMM TVL
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Fixed APY
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Long yield APY
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Pool APY
                  </th>
                </tr>
              </thead>
              <tbody>
                {" "}
                {markets.map((market, index) => {
                  const maturityInfo = getMaturityInfo(market.maturity.unixTs);
                  return (
                    <tr key={index} className="border-t border-gray-700">
                      <td className="px-4 py-3 flex items-center">
                        <img
                          src={market.asset.icon}
                          alt={market.asset.name}
                          className="w-10 h-10 mr-3 rounded-full"
                        />
                        <div>
                          <div className="font-medium text-white">
                            {market.asset.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {market.asset.fullName}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white">{maturityInfo.date}</div>
                        <div className="text-sm text-gray-400">
                          {maturityInfo.daysLeft} days left
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white">{market.ammTvl}</td>
                      <td className="px-4 py-3">
                        <div className="bg-blue-500/30 rounded-lg px-3 py-1.5">
                          <Link href={`/market/${market.marketId}`}>
                            <div className="flex items-center justify-between">
                              <div className="text-blue-500 font-ataero font-bold text-base">
                                PT
                              </div>
                              <div>
                                <div className="text-white">
                                  {market.pt.apy}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {market.pt.price}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="bg-cyan-500/30 rounded-lg px-3 py-1.5">
                          <Link href={`/market/${market.marketId}`}>
                            <div className="flex items-center justify-between">
                              <div className="text-cyan-500 font-ataero font-bold text-base">
                                YT
                              </div>
                              <div>
                                <div className="text-white">
                                  {market.yt.apy}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {market.yt.price}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white">
                        <div className="bg-indigo-500/30 rounded-lg px-3 py-1.5 items-center">
                          <Link href={`/market/${market.marketId}`}>
                            <div className="flex items-center justify-between flex flex-col">
                              <div className="text-indigo-500 font-ataero font-bold text-base">
                                LP
                              </div>
                              <div>
                                <div className="text-white">
                                  {market.lp.apy}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
