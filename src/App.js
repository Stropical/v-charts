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

function App() {
  const canvasRef = useRef(null)
  const [algo_data, setAlgo] = useState(null);
  const [total_prof, setTPROF] = useState(0);
  const [avgTrade, setAvgTrade] = useState(0)

  let chartData = null;
  let btData = null;

  const render = (ctx, canvas) => {
    // Bg
    if (!chartData) {
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
    if (!bars) {
      return;
    }

    const chart_height = 400;
    const chart_width = 1500;

    // Render main chart
    const scale = 300;
    const offset = 300;
    const RENDER_BAR_WIDTH = 6;

    for (let i = bars.length - 1; i >= 0; i--) {
      ctx.shadowColor = "black";
      ctx.shadowBlur = 0;

      

      // Y coord
      const norm_val = (bars[i].open - bars[bars.length - 1].open);
      const hl_norm = (bars[i].low - bars[bars.length - 1].open);


      let x = (bars.length - i) * -RENDER_BAR_WIDTH + (chart_width * 4 / 5)
      let y = norm_val * -scale + offset;
      let bar_height = -scale * (bars[i].close - bars[i].open) + 1;
      let hl_height = -scale * (bars[i].high - bars[i].low);

      if(btData && btData[i] && btData[i].res.trade) {
        console.log(btData[i].res.trade)
        if(btData[i].res.trade.direction == 'long') {
          ctx.fillStyle = "#56eb49";
          ctx.fillRect(x, y+100, RENDER_BAR_WIDTH - 2, 5);
          ctx.fillRect(x, y-100, RENDER_BAR_WIDTH - 2, 5);
        } else if(btData[i].res.trade.direction == 'short') {
          ctx.fillStyle = "#f04a4a";
          ctx.fillRect(x, y+100, RENDER_BAR_WIDTH - 2, 5);
          ctx.fillRect(x, y-100, RENDER_BAR_WIDTH - 2, 5);
        } else {

        }
        
      }

      // Color for bars
      if (bars[i].open > bars[i].close) {
        ctx.fillStyle = "#f04a4a";
      } else {
        ctx.fillStyle = "#56eb49";
      }


      ctx.fillRect(x, y, RENDER_BAR_WIDTH - 2, bar_height);
      ctx.fillRect(x + (RENDER_BAR_WIDTH / 2), hl_norm * -scale + offset, 1, hl_height);
    }

    let sum_indicators = [];
    // Sum indicators
    if (btData && bars && btData.length > 0) {
      btData.forEach((btPoint) => {
        let res = btPoint.res
        if (res) {
          res.indicators.forEach((indic, i) => {
            if (sum_indicators.length <= i) { sum_indicators.push([]) }
            sum_indicators[i].push(indic)
          })
        }
      })
    }

    const ALT_TF = 5;
    const SKIPPED_BARS = 4;

    //console.log(sum_indicators)
    sum_indicators.forEach((indic, i) => {  
      ctx.lineWidth = 1;
      ctx.lineCap = "round";

      switch (i) {
        case 0: ctx.strokeStyle = "#f00"; break;
        case 1: ctx.strokeStyle = "#3266a8"; ctx.lineWidth = 2; break;
        case 2: ctx.strokeStyle = "#3266a8"; ctx.lineWidth = 2; break;
        case 3: ctx.strokeStyle = "#0ff"; ctx.lineWidth = 1; break;
      }

      ctx.beginPath(); // Start a new path

    

      for (let i = indic.length - 1; i >= 0; i--) {
        let x = (bars.length - i) * -RENDER_BAR_WIDTH + (chart_width * 4 / 5) + (ALT_TF * RENDER_BAR_WIDTH * SKIPPED_BARS) + (RENDER_BAR_WIDTH / 2) // 3 to account for skipped bars in alpha (too few to) || 10/2 to center line
        let y = (indic[i].value - bars[bars.length - 1].open) * -scale + offset;

        if (i == 0) {
          //console.log('First: ', x, y)
        }

        if (indic[i].value != null) {
          //console.log(indic[i].value)
          ctx.lineTo(x, y);
        }

        //ctx.moveTo(x, y);

      }
      ctx.stroke();
    });

    // Draw trade limit prices
    if(btData) {
      for (let i = btData.length - 1; i >= 0; i--) {
        if(btData[i] && btData[i].trade && btData[i].trade.price) {
          let x = (bars.length - i) * -RENDER_BAR_WIDTH + (chart_width * 4 / 5) + (ALT_TF * RENDER_BAR_WIDTH * SKIPPED_BARS) + (RENDER_BAR_WIDTH / 2) // 3 to account for skipped bars in alpha (too few to) || 10/2 to center line
          let y = (btData[i].trade.price - bars[bars.length - 1].open) * -scale + offset;
  
          ctx.fillRect(x, y, 10, 10);
        }
      }
    }
    
    let trades = [];
    if(btData) {
      btData.forEach((point) => {
        let trade = point.res.trade;
        if(trade) { console.log(trade)}
        if(trade) {
          trades.push({ direction: trade.direction, size: 1, profit: 0 })
        }
      })

     
  
      setAlgo(trades)
    }
    
  }

  const compute_stats = (chart_data, algo_data) => {
    let trades = [];
    let open_price = 0, open_dir = '';
    if (algo_data.trades) {
      algo_data.trades.forEach((e, i) => {
        if (e.type == 'entry') {
          open_price = chart_data.kline[i].open;
          open_dir = e.res.trade
        } else {
          let delta = open_dir == 'long' ? chart_data.kline[i].close / open_price : open_price / chart_data.kline[i].close
          let profit = e.size * (delta - 1);

          trades.push({ direction: open_dir, size: e.size, profit: profit })
        }
      });
    }

    return trades.slice(1, trades.length - 1)
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
      console.log(btData)
      render(ctx, canvas)
    })

    setInterval(() => {
      socket.emit('backtest')
    }, 5000)

  }, [])

  return (
    <div className="app">
      <div className='app-cont'>
        <canvas width="1500" height="600" ref={canvasRef} />
        <div className='stats-pane'>
          <div className='stat-headers'>
            <div className='stat-header'>
              <h5 style={{ margin: '5px' }} id="">${total_prof.toFixed(3)} / {((total_prof + 100) / 100).toFixed(3)}%</h5>
              <h6 style={{ margin: '5px', color: '#ddd' }}>PROFIT</h6>
            </div>

            <div className='stat-header'>
              <h5 style={{ margin: '5px' }} id="">{avgTrade.toFixed(3)} / {(avgTrade / 100).toFixed(3)}%</h5>
              <h6 style={{ margin: '5px', color: '#ddd' }}>AVG - TRADE</h6>
            </div>

            <div className='stat-header'>
              <h5 style={{ margin: '5px' }} id="">{10} / 5 IBA</h5>
              <h6 style={{ margin: '5px', color: '#ddd' }}>TRADES</h6>
            </div>
          </div>
          <h6 style={{ margin: ' 5px 18px 5px 18px', color: '#ddd' }}>TRADE LIST:</h6>
          <div style={{ overflow: 'hidden', overflowY: 'scroll', height: '300px' }}>
            <ul style={{ wdith: '500px', listStyleType: 'none', marginTop: '5px', padding: '0', border: '1px solid #aaa' }}>
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
                      <p className='direction-text' style={{ color: obj.direction == 'long' ? H1 : H2 }}><b>{obj.direction}</b></p>
                      <p className='info-text'>Position size:</p>
                      <p className='direction-text' style={{ color: obj.size > 0 ? H1 : H2 }}><b>${obj.size}</b></p>
                      <p className='info-text'>Profit</p>
                      <p className='direction-text' style={{ color: obj.direction == 'long' ? H1 : H2 }}><b>${obj.profit.toFixed(3)}</b></p>
                    </li>
                  )
                }) : ''
              }
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
