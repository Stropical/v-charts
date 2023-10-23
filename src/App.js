import logo from './logo.svg';
import './App.css';
import Layout from './Layout';
import { useRef, useEffect, useState, createContext } from 'react';
import { init, dispose, Chart, registerOverlay } from 'klinecharts'

import socketIO from 'socket.io-client';
const socket = socketIO.connect('http://localhost:5757');

const URL = 'http://172.178.57.112:5656'

const H1 = "#a3f598"
const H2 = "#e67c7c"

const IN_VIEW = 70

const change_tf = (bars, tf) => {
  let bar_count = 0;
  let new_bars = [];

  let open = 0, volume = 0, high = 0, low = 100000000;
  bars.forEach((bar) => {
    // Sum volume
    volume += bar.volume;

    if(high < bar.high) { high = bar.high }
    if(low > bar.low) { low = bar.low }

    // Grab open of first bar
    if(open == 0) {
      open = bar.open;
    }

    if(bar_count % tf == 0) {
      new_bars.push({
        open: open,
        close: bar.close,
        high: high,
        low: low
      })

      // Reset
      open = 0;
      volume = 0;
      high = 0;
      low = 1000000000;
    }

    bar_count++;
  })

  return new_bars;
}

function App() {
  const canvasRef = useRef(null)
  const [algo_data, setAlgo] = useState(null);
  const [total_prof, setTPROF] = useState(0);
  const [avgTrade, setAvgTrade] = useState(0)
  
  let chartData = null;
  let btData = null;

  const render = (ctx, canvas) => {
    // Bg
    if(!chartData) {
      console.log('No chart data')
      socket.emit('req_data')
      return;
    }

    const grd = ctx.createLinearGradient(0, 0, 0, 800);
    grd.addColorStop(0, "#141515");
    grd.addColorStop(1, "#141515");

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // DRAW BARS
    //let bars = change_tf(chart_data.kline, 15);
    let bars = chartData.kline
    if(!bars) {
      return;
    }

    const chart_height = 400;
    const chart_width = 800;

    // Render main chart
    const scale = 300;
    const offset = 200;

    for(let i = bars.length-1; i >= 0; i--) {
     

      ctx.shadowColor="black";
      ctx.shadowBlur = 0;

      if(bars[i].open > bars[i].close) {
        ctx.fillStyle = "#f04a4a";
      } else {
        ctx.fillStyle = "#56eb49";
      }

      // Y coord
      const norm_val = (bars[i].open - bars[bars.length-1].open);
      const hl_norm = (bars[i].low - bars[bars.length-1].open);
      

      let x = (bars.length - i) * -12 + (chart_width*4/5)
      let y = norm_val * -scale + offset;
      let bar_height = -scale * (bars[i].close - bars[i].open)+1;
      let hl_height = -scale * (bars[i].high - bars[i].low);

      
      ctx.fillRect(x, y, 10, bar_height);
      ctx.fillRect(x+1.5, hl_norm * -scale + offset, 1, hl_height);

      /*if(i == 0) {
        console.log('First bars: ', x, y)
      }*/
    }

    let sum_indicators = [[]];
    // Sum indicators
    if(btData && bars && btData.length > 0) {
      btData.forEach((btPoint) => {
        let res = btPoint.res
        if(res) {
          res.indicators.forEach((indic, i) => {
            sum_indicators[i].push(indic)
          })
        }
      })
    }

    console.log(sum_indicators)
    sum_indicators.forEach((indic, i) => {
        ctx.strokeStyle = "#f00"

        ctx.lineWidth = 1;
        ctx.beginPath(); // Start a new path

        console.log(indic)

        for(let i = indic.length-1; i >= 0; i--) {
            let x = (bars.length - i) * -12 + (chart_width*4/5)
            let y = (indic[i].value - bars[bars.length-1].open) * -scale + offset;

            if(i == 0) {
              console.log('First: ', x, y)
            }

            if(indic[i].value > -2) {
              console.log(indic[i].value)
              ctx.lineTo(x, y);
            }
            
            //ctx.moveTo(x, y);

        }
        ctx.stroke();
      });
    
    /*
    ctx.lineWidth = 3;
    ctx.beginPath();
    const zigzag = algo_data.indicators[0].values
    //console.log(zigzag.slice(0, 10))

    // Iterate backwards on bars
    for(let i = zigzag.length-1; i >= 0; i--) {
      if(zigzag[i] && i*20 < bars.length) {
        let x = (zigzag.length - i) * -5 * (20) + (chart_width*4/5)
        let y = (19 - bars[i*20].close) * -scale + offset;

        //console.log(x, y)
        if(x > 0) {
         
        } else {
          //console.log(x)
        }
  
        ctx.lineTo(x, y)
      }


    }
    ctx.stroke()*/
  }


  const compute_stats = (chart_data, algo_data) => {
    let trades = [];
    let open_price = 0, open_dir = '';
    if(algo_data.trades) {
      algo_data.trades.forEach((e, i) => {
          if(e.type == 'entry') {
            open_price = chart_data.kline[i].open;
            open_dir = e.direction
          } else {
              let delta =  open_dir == 'long' ? chart_data.kline[i].close / open_price :  open_price / chart_data.kline[i].close
              let profit = e.size * (delta-1);

              trades.push({direction: open_dir, size: e.size, profit: profit})
          }
      });
    }

    return trades.slice(1, trades.length-1)
  }

  useEffect(() => {
    // My chart
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    socket.on('tick', (data) => {
      // Got price data
      chartData = data;
      render(ctx, canvas)
    })

    socket.on('backtest_finished', (data) => {
      btData = data;
      render(ctx, canvas)
    })

    setInterval(async () => {
      
      /*
      let chart_data = await get_data();
      let algo_data = await get_indic();
      
      
      let cstats = compute_stats(chart_data, algo_data)

      let temp_total_prof = 0;
      cstats.forEach((tr) => {
        temp_total_prof += tr.profit
      })

      setAvgTrade(temp_total_prof / cstats.length)
      setTPROF(temp_total_prof)
      setAlgo(cstats)

      //console.log(algo_data)

      //console.log(chart_data.kline[chart_data.kline.length-1].close)

      //kchart.current.applyNewData(chart_data.kline)
      //compute_stats(chart_data, algo_data)
      render(ctx, canvas, chart_data, algo_data)
     */
 
    }, 500)
    setInterval(() => {
      socket.emit('backtest')
    }, 5000)
    
  }, [])

  return (
    <div className="app">
      <div className='app-cont'>
        <canvas width="800" height="600" ref={canvasRef}/>
        <div className='stats-pane'>
          <div className='stat-headers'>
            <div className='stat-header'>
              <h5 style={{margin: '5px'}} id="">${total_prof.toFixed(3)} / {((total_prof + 100) / 100).toFixed(3)}%</h5>
              <h6 style={{margin: '5px', color: '#ddd'}}>PROFIT</h6>
            </div>

            <div className='stat-header'>
            <h5 style={{margin: '5px'}} id="">{avgTrade.toFixed(3)} / {(avgTrade / 100).toFixed(3)}%</h5>
              <h6 style={{margin: '5px', color: '#ddd'}}>AVG - TRADE</h6>
            </div>

            <div className='stat-header'>
              <h5 style={{margin: '5px'}} id="">{10} / 5 IBA</h5>
              <h6 style={{margin: '5px', color: '#ddd'}}>TRADES</h6>
            </div>
          </div>
          <h6 style={{margin: ' 5px 18px 5px 18px', color: '#ddd'}}>TRADE LIST:</h6>
          <div style={{overflow: 'hidden', overflowY: 'scroll', height: '300px'}}>
            <ul style={{wdith: '500px', listStyleType: 'none', marginTop: '5px', padding: '0', border: '1px solid #aaa'}}>
                {
                  algo_data ? algo_data.map((obj, i) => {
                    return (
                      <li style={{
                        display: 'flex',
                        flexDirection: 'row',
                        padding: '5px'
                      }}>
                        <p className='info-text'>Trade #{i}</p> 
                        <p className='info-text'>Direction:</p>
                        <p className='direction-text' style={{color: obj.direction == 'long' ? H1 : H2}}><b>{obj.direction}</b></p>
                        <p className='info-text'>Position size:</p> 
                        <p className='direction-text' style={{color: obj.size > 0 ? H1 : H2}}><b>${obj.size}</b></p>
                        <p className='info-text'>Profit</p> 
                        <p className='direction-text' style={{color: obj.direction == 'long' ? H1 : H2}}><b>${obj.profit.toFixed(3)}</b></p>
                      </li>
                    )
                  })  : ''
                }
            </ul>
          </div>
        </div>
       
      </div>
    </div>
  );
}

export default App;
